import { XY_REFRESH_MS, XY_SELL_MS } from '../data/constants';
import { DURABILITY, copyValue, sellChance } from '../data/balance';
import { XY_REFRESH_COST } from '../data/prices';
import { GAMES, REGULAR_GAMES, gameById } from '../data/games';
import type { Game, Rarity } from '../data/types';
import type { GameState, MarketItem } from '../state';
import { copyByUid } from '../state';
import { isMastered } from '../mechanics/collection';
import { canStore } from '../mechanics/play';
import { copyValueOf, copyRarity, sellFeeRate, xyPriceMult } from '../mechanics/economy';
import { perkLv } from '../mechanics/prestige';
import { challengeMods, challengeShopLv, distinctCapBlock } from '../mechanics/challenge';
import { designByGameId } from '../mechanics/design';
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
 * 刷新一批某鱼货源：件数 = (marketSlots + 1) × 挑战件数倍率（1~15）+ 1 件一口价盲买，批内不重复。
 * 每件是一个实体：随机成色（3~10成新的耐久）、概率带牌套/收纳；
 * 火眼金睛（挑战商店）提高高成色/带牌套概率；
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
  // 挑战件数倍率（<1 更少 / >1 更多）作用于本批总件数（含 1 件一口价），clamp 1~15
  const total = Math.min(15, Math.max(1, Math.round((state.marketSlots + 1) * (challengeMods(state).xyCountMult ?? 1))));
  const n = Math.max(0, total - 1); // 普通货源件数 = 总件数 − 1 件必出的一口价
  // 火眼金睛：每级 +8% 带牌套概率（封顶 100%）、成色下限 +15%
  const eye = challengeShopLv(state, 'xyEye');
  const sleeveP = Math.min(1, 0.25 + 0.08 * eye);
  const condFloor = 0.3 + 0.15 * eye;
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
    const durability = Math.max(1, Math.round(maxDur * Math.min(1, condFloor + rng() * 0.7)));
    const sleeved = !!g.cards && rng() < sleeveP;
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
  const bDurability = Math.max(1, Math.round(DURABILITY[bg.rarity] * Math.min(1, condFloor + rng() * 0.7)));
  const bSleeved = !!bg.cards && rng() < sleeveP;
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
  // 挑战刷新间隔倍率（<1 更快）
  state.xyNext = now + XY_REFRESH_MS * (challengeMods(state).xyRefreshMult ?? 1);
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
 * 某鱼成交率（含好口碑天赋与挑战成交率倍率，封顶 100%）：
 * 挂售判定与「预计成交率」展示共用此函数，保证看见的就是掷骰用的。
 */
export function sellChanceFinal(state: GameState, ratio: number, durability: number, rarity: Rarity): number {
  return Math.min(1, sellChance(ratio, durability, rarity)
    * (1 + 0.1 * perkLv(state, 'sellBoost')) * (challengeMods(state).sellChanceMult ?? 1));
}

/**
 * 某鱼计时（两个独立时钟）：
 * 1) 货源刷新：xyNext 到点自动刷新（5 分钟）；
 * 2) 成交判定：xySellNext 每 30 秒对每件上架商品按「定价倍率 × 成色」掷一次骰
 *    （好口碑天赋提升成交率）；卖出收取手续费。
 */
export function tickXianyu(
  state: GameState,
  rng: () => number = Math.random,
  now: number = Date.now(),
): XianyuTickResult {
  const result: XianyuTickResult = { refreshed: false, sold: [] };
  if (state.xyNext && now >= state.xyNext) {
    const r = refreshXianyu(state, false, rng, now);
    result.refreshed = r.ok;
  }
  // 商路亨通：成交判定提速一倍（30 秒 → 15 秒）
  const sellCd = XY_SELL_MS / (perkLv(state, 'sellHaste') > 0 ? 2 : 1);
  if (!state.xySellNext) {
    state.xySellNext = now + sellCd; // 判定时钟未初始化：本 tick 只武装不判定
  } else if (now >= state.xySellNext) {
    state.xySellNext = now + sellCd;
    for (let i = state.listings.length - 1; i >= 0; i--) {
      const l = state.listings[i];
      const copy = copyByUid(state, l.copyUid);
      if (!copy) {
        state.listings.splice(i, 1); // 实体丢失（不应发生），清理
        continue;
      }
      const name = copy.designed ? (designByGameId(state, copy.gameId)?.name ?? '自创桌游') : gameById(copy.gameId).name;
      const value = copyValueOf(state, copy); // 自创设计按众筹售价取价
      const chance = sellChanceFinal(state, l.price / value, copy.durability, copyRarity(copy));
      if (rng() < chance) {
        const gain = Math.round(l.price * (1 - sellFeeRate(state)));
        state.money += gain;
        state.copies = state.copies.filter(c => c.uid !== l.copyUid);
        state.listings.splice(i, 1);
        state.stats.soldCount++;
        state.stats.xyEarned += gain; // 某鱼卖出净额累计（挑战「无薪挑战」目标）
        if (l.price >= value * 2) state.stats.highPriceSold++; // 200% 定价成交
        // 唯一副本卖光 → 打回头客标记
        const col = state.collections[copy.gameId];
        if (col && !state.copies.some(c => c.gameId === copy.gameId)) col.resold = true;
        result.sold.push({ gameId: copy.gameId, name, price: l.price, gain });
      }
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
  const block = distinctCapBlock(state, it.gameId); // 挑战「款数上限」：到限拒购新款（先扣款前拦截）
  if (block) return { ok: false, reason: block };
  state.money -= it.price;
  state.xianyuBuys.splice(index, 1);
  // 复用 acquire 的开箱奖励逻辑，但实体成色以货源为准
  const wasOpened = state.collections[it.gameId]?.firstOpened === true;
  const r = acquireGame(state, it.gameId);
  r.copy.durability = it.durability;
  r.copy.sleeved = it.sleeved;
  r.copy.stored = it.stored;
  if (wasOpened) r.first = false; // 防万一：已开箱过的收藏不重复给奖励
  // 捡漏判定：不高于总价值 90%
  if (it.price <= marketItemValue(it) * 0.9) state.stats.bargainBuys++;
  state.stats.xyBought++;
  return { ok: true, gameId: it.gameId, blind: it.blind === true };
}
