import { REGULAR_GAMES } from './games';
import type { Game, Rarity } from './types';

// ---------- 价格派生（某宝九折基准；单抽价 ≈ 某宝均价 1/3） ----------

/** 某宝基础价 = 市场价 × 0.9（四舍五入） */
export function taobaoBase(g: Game): number {
  return Math.round(g.marketPrice * 0.9);
}

/** 某赏单抽价格（固定值，由常规款某宝均价推出） */
export const GACHA_PRICE: number = Math.round(
  REGULAR_GAMES.reduce((s, g) => s + taobaoBase(g), 0) / REGULAR_GAMES.length / 3,
);

/** 某赏稀有度概率：N 62% / R 28% / SR 8% / SSR 2%（按序累加判定） */
export const GACHA_RATES: readonly (readonly [Rarity, number])[] = [
  ['SSR', 0.02],
  ['SR', 0.08],
  ['R', 0.28],
  ['N', 0.62],
];

/** 某赏重复款转化的牌套包数（每包 50 张） */
export const GACHA_SLEEVE_PACKS: Record<Rarity, number> = { N: 5, R: 10, SR: 20, SSR: 40 };

/** 某赏重复款叠加的熟练度 */
export const GACHA_PROF_GAIN: Record<Rarity, number> = { N: 4, R: 8, SR: 16, SSR: 32 };

/** 某鱼手动刷新费用（元） */
export const XY_REFRESH_COST = 20;
