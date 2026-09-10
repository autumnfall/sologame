import { FATIGUE_SOFTCAP, MASTERY, PLAY_CAP_MIN } from '../data/constants';
import { taobaoBase } from '../data/prices';
import type { Game } from '../data/types';
import type { Copy, GameState } from '../state';
import { attrLevel } from './attrs';
import { hasAffix } from './collection';

/** 疲劳收益修正 = 1/(1+疲劳×0.15)（软上限外不再加重）；疲劳为收藏级 */
export function fatigueMod(state: GameState, g: Game): number {
  const f = state.collections[g.id]?.fatigue ?? 0;
  return 1 / (1 + Math.min(f, FATIGUE_SOFTCAP * 2) * 0.15);
}

/**
 * 游玩段游戏内分钟数。
 * 熟练度：首局 ×1.8，之后每局 -2%（下限 ×0.65）；精通后再 ×0.5；
 * 牌套（实体级）×0.85；隐藏款 timeCut 词条 ×0.90；演算每级 -2%（下限 ×0.80）；最低 3 分钟。
 */
export function playDuration(state: GameState, g: Game, copy?: Copy): number {
  const c = state.collections[g.id];
  const prof = c?.prof ?? 0;
  let m = Math.min(g.playTime, PLAY_CAP_MIN);
  m *= prof === 0 ? 1.8 : Math.max(0.65, 1 - 0.02 * prof);
  if (prof >= MASTERY[g.rarity]) m *= 0.5;
  if (copy?.sleeved) m *= 0.85;
  if (hasAffix(state, 'timeCut')) m *= 0.90;
  m *= Math.max(0.80, 1 - 0.02 * attrLevel(state, '演算'));
  return Math.max(3, m);
}

/** Setup 段分钟数（实体收纳后 ×0.5） */
export function setupDuration(state: GameState, g: Game, copy?: Copy): number {
  return g.setupTime * (copy?.stored ? 0.5 : 1);
}

/** 读规则段分钟数（收藏级：规则已读后为 0，自动跳过） */
export function ruleDuration(state: GameState, g: Game): number {
  return state.collections[g.id]?.rulesRead ? 0 : g.weight * 8;
}

/** 精通/熟练度展示文案（收藏级） */
export function masteryText(state: GameState, g: Game): string {
  const c = state.collections[g.id];
  if (!c) return '';
  const need = MASTERY[g.rarity];
  return c.prof >= need ? '⭐已精通（时长×0.5）' : `熟练 ${c.prof}/${need}`;
}

/** 收纳仅对贵价（市场价 >¥200）或大盒游戏有效 */
export function canStore(g: Game): boolean {
  return g.marketPrice > 200 || g.tags.includes('大盒');
}

/** 收纳成本 = 某宝基础价 × 0.2 */
export function storageCost(g: Game): number {
  return Math.round(taobaoBase(g) * 0.2);
}
