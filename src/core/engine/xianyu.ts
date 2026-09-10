import { XY_REFRESH_MS } from '../data/constants';
import { XY_REFRESH_COST } from '../data/prices';
import { GAMES, REGULAR_GAMES, gameById } from '../data/games';
import type { Game } from '../data/types';
import type { GameState, XianyuItem } from '../state';
import { isMastered } from '../mechanics/collection';
import { xyPriceMult } from '../mechanics/economy';
import { acquireGame } from './acquire';
import type { AcquireResult } from './acquire';

export interface RefreshResult {
  ok: boolean;
  reason?: string;
  items?: XianyuItem[];
}

/**
 * 刷新一批某鱼货源：3~5 件，批内去重，价格 = 市场价 ×(50%~200%)×运筹砍价（最低 ¥10）。
 * 8% 概率刷出隐藏款；已精通的桌游不再出现；收藏更新后已拥有的不可购买（UI 双重校验）。
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
  const n = 3 + Math.floor(rng() * 3);
  const items: XianyuItem[] = [];
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
    const mul = (0.5 + rng() * 1.5) * xyPriceMult(state);
    items.push({ id: g.id, price: Math.max(10, Math.round(g.marketPrice * mul)) });
  }
  state.xianyu = items;
  state.xyNext = now + XY_REFRESH_MS;
  return { ok: true, items };
}

/** 某鱼自动到货：到达 xyNext 时刷新。返回是否触发了刷新。 */
export function tickXianyu(
  state: GameState,
  rng: () => number = Math.random,
  now: number = Date.now(),
): boolean {
  if (!state.xyNext) return false;
  if (now < state.xyNext) return false;
  refreshXianyu(state, false, rng, now);
  return true;
}

/** 购买某鱼第 i 件货源（含入收藏与开箱奖励） */
export function buyXianyu(state: GameState, index: number): { ok: boolean; reason?: string; gameId?: string; acquire?: AcquireResult } {
  const it = state.xianyu[index];
  if (!it) return { ok: false, reason: '货源不存在' };
  if (state.money < it.price) return { ok: false, reason: '钱不够' };
  if ((state.owned[it.id]?.count ?? 0) > 0) return { ok: false, reason: '已收藏过这款桌游' };
  state.money -= it.price;
  state.xianyu.splice(index, 1);
  return { ok: true, gameId: it.id, acquire: acquireGame(state, it.id) };
}

/** 货架展示用：某件货源相对市场价的百分比 */
export function xianyuPriceRatio(item: XianyuItem): number {
  return Math.round((item.price / gameById(item.id).marketPrice) * 100);
}
