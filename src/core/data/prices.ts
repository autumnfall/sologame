import { REGULAR_GAMES } from './games';
import type { Game } from './types';

// ---------- 价格派生（某宝九折基准；单抽价 ≈ 某宝均价 1/3） ----------

/** 某宝基础价 = 市场价 × 0.9（四舍五入） */
export function taobaoBase(g: Game): number {
  return Math.round(g.marketPrice * 0.9);
}

/** 某赏常驻池单抽价格（固定值，由常规款某宝均价推出） */
export const GACHA_PRICE: number = Math.round(
  REGULAR_GAMES.reduce((s, g) => s + taobaoBase(g), 0) / REGULAR_GAMES.length / 3,
);

/** 某鱼手动刷新费用（元） */
export const XY_REFRESH_COST = 20;
