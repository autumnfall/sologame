import { XY_REFRESH_MS } from '../data/constants';
import { DURABILITY, copyValue, sellChance } from '../data/balance';
import { XY_REFRESH_COST } from '../data/prices';
import { GAMES, REGULAR_GAMES, gameById } from '../data/games';
import type { Game } from '../data/types';
import type { GameState, MarketItem } from '../state';
import { copyByUid } from '../state';
import { isMastered } from '../mechanics/collection';
import { canStore } from '../mechanics/play';
import { sellFeeRate, xyPriceMult } from '../mechanics/economy';
import { perkLv } from '../mechanics/prestige';
import { acquireGame } from './acquire';

export interface RefreshResult {
  ok: boolean;
  reason?: string;
  items?: MarketItem[];
}

/** 一件货源的总价值（定价基础） */
export function marketItemValue(item: MarketItem): number {
  const g = gameById(item.gameId);
  return copyValue(g.marketPrice, g.cards, item.durability, g.rarity, item.sleeved, item.stored);
}

/**
 * 刷新一批某鱼货源：件数 = marketSlots（3~7）+ 1 件一口价盲买，批内不重复。
 * 每件是一个实体：随机成色（3~10成新的耐久）、概率带牌套/收纳；
 * 普通货价格 = 总价值 ×(50%~200%)×运筹砍价（最低 ¥10）；
 * 一口价只显示桌游名称，成色/牌套/收纳不可见，价格 = 总价值 ×(80%~120%)。
 * 8% 概率刷出隐藏款；已精通的桌游不再出现；可与玩家已拥有（未精通）的重复。
 */
export function refreshXianyu(
  state: GameState,
  paid: boolean,
  rng: () => number = Math.random,
  now: number = Date.now(),
): RefreshResult {
  if (paid) {
    if (state.money < XY_REFRESH_COST) return { ok: false, reason: '钱不够刷新' };
    state.money -= XY_REFRESH_COST;
  }
  const hidden = GAMES.filter(g => g.hidden && !isMastered(state, g.id));
  const normal = REGULAR_GAMES.filter(g => !isMastered(state, g.id));
  if (!normal.length && !hidden.length) return { ok: false, reason: '所有桌游均已精通，暂无货源' };
  const n = state.marketSlots;
  const items: MarketItem[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let g: Game;
    let tries = 0;
    do {
      g = hidden.length && rng() < 0.08
        ? hidden[Math.floor(rng() * hidden.length)]
        : normal[Math.floor(rng() * normal.length)];
      tries++;
    } while (used.has(g.id) && tries < 30);
    if (used.has(g.id)) continue;
    used.add(g.id);
    const maxDur = DURABILITY[g.rarity];
    const durability = Math.max(1, Math.round(maxDur * (0.3 + rng() * 0.7)));
    const sleeved = !!g.cards && rng() < 0.25;
    const stored = canStore(g) && rng() < 0.2;
    const value = copyValue(g.marketPrice, g.cards, durability, g.rarity, sleeved, stored);
    const price = Math.max(10, Math.round(value * (0.5 + rng() * 1.5) * xyPriceMult(state)));
    items.push({ gameId: g.id, price, durability, sleeved, stored });
  }
  // 一口价盲买：必定出现 1 件，与普通货源不重复；尽量选未用过的款
  const pickOne = (exclude: boolean): Game => {
    let g: Game;
    let tries = 0;
    do {
      g = hidden.length && rng() < 0.08
        ? hidden[Math.floor(rng() * hidden.length)]
        : normal[Math.floor(rng() * normal.length)];
      tries++;
    } while (exclude && used.has(g.id) && tries < 30);
    return g;
  };
  const bg = pickOne(true);
  used.add(bg.id);
  const bDurability = Math.max(1, Math.round(DURABILITY[bg.rarity] * (0.3 + rng() * 0.7)));
  const bSleeved = !!bg.cards && rng() < 0.25;
  const bStored = canStore(bg) && rng() < 0.2;
  const bValue = copyValue(bg.marketPrice, bg.cards, bDurability, bg.rarity, bSleeved, bStored);
  items.push({
    gameId: bg.id,
    price: Math.max(10, Math.round(bValue * (0.8 + rng() * 0.4))),
    durability: bDurability,
    sleeved: bSleeved,
    stored: bStored,
    blind: true,
  });
  state.xianyuBuys = items;
  state.xyNext = now + XY_REFRESH_MS;
  return { ok: true, items };
}

export interface SoldItem {
  gameId: string;
  name: string;
  price: number;
  /** 到账金额（已扣手续费） */
  gain: number;
}

export interface XianyuTickResult {
  refreshed: boolean;
  sold: SoldItem[];
}

/**
 * 某鱼 5 分钟计时：到点自动刷新货源，并对每件上架商品按
 * 「定价倍率 × 成色」做成交判定（判定同样只在 5 分钟到点时进行一次，
 * 期间每秒的 tick 不会重复掷骰）；卖出收取 5% 手续费。
 */
export function tickXianyu(
  state: GameState,
  rng: () => number = Math.random,
  now: number = Date.now(),
): XianyuTickResult {
  const result: XianyuTickResult = { refreshed: false, sold: [] };
  if (!state.xyNext || now < state.xyNext) return result;
  const r = refreshXianyu(state, false, rng, now);
  result.refreshed = r.ok;
  for (let i = state.listings.length - 1; i >= 0; i--) {
    const l = state.listings[i];
    const copy = copyByUid(state, l.copyUid);
    if (!copy) {
      state.listings.splice(i, 1); // 实体丢失（不应发生），清理
      continue;
    }
    const g = gameById(copy.gameId);
    const value = copyValue(g.marketPrice, g.cards, copy.durability, g.rarity, copy.sleeved, copy.stored);
    const chance = Math.min(1, sellChance(l.price / value, copy.durability, g.rarity) * (1 + 0.1 * perkLv(state, 'sellBoost')));
    if (rng() < chance) {
      const gain = Math.round(l.price * (1 - sellFeeRate(state)));
      state.money += gain;
      state.copies = state.copies.filter(c => c.uid !== l.copyUid);
      state.listings.splice(i, 1);
      result.sold.push({ gameId: g.id, name: g.name, price: l.price, gain });
    }
  }
  return result;
}

/** 购买某鱼第 i 件货源：按实体成色入收藏（熟练度等收藏级进度自动保留/继承）；blind = 一口价盲买 */
export function buyXianyu(
  state: GameState,
  index: number,
): { ok: boolean; reason?: string; gameId?: string; blind?: boolean } {
  const it = state.xianyuBuys[index];
  if (!it) return { ok: false, reason: '货源不存在' };
  if (state.money < it.price) return { ok: false, reason: '钱不够' };
  state.money -= it.price;
  state.xianyuBuys.splice(index, 1);
  // 复用 acquire 的开箱奖励逻辑，但实体成色以货源为准
  const wasOpened = state.collections[it.gameId]?.firstOpened === true;
  const r = acquireGame(state, it.gameId);
  r.copy.durability = it.durability;
  r.copy.sleeved = it.sleeved;
  r.copy.stored = it.stored;
  if (wasOpened) r.first = false; // 防万一：已开箱过的收藏不重复给奖励
  return { ok: true, gameId: it.gameId, blind: it.blind === true };
}
