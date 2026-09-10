import { GLOBAL_PER_KIND, GLOBAL_SOFTCAP, MASTERY } from '../data/constants';
import type { Rarity } from '../data/types';
import { gamesByRarity } from '../data/games';
import { gameById } from '../data/games';
import type { AffixType } from '../data/types';
import type { GameState } from '../state';

/** 已收藏的桌游种数（count > 0，含隐藏款） */
export function kindCount(state: GameState): number {
  return Object.values(state.owned).filter(o => o.count > 0).length;
}

/**
 * 图鉴加成：每多一种桌游全属性经验 +1.5%（软上限 +50%，超出部分 ×0.1 递减）。
 * 游玩经验与工作收入均受它影响。
 */
export function globalBonus(state: GameState): number {
  const raw = kindCount(state) * GLOBAL_PER_KIND;
  return raw <= GLOBAL_SOFTCAP ? raw : GLOBAL_SOFTCAP + (raw - GLOBAL_SOFTCAP) * 0.1;
}

/** 是否拥有指定类型的隐藏款词条 */
export function hasAffix(state: GameState, type: AffixType): boolean {
  return Object.keys(state.owned).some(
    id => state.owned[id].count > 0 && gameById(id).affix?.type === type,
  );
}

/** EXT: 标签共鸣套装加成（占位，当前恒为 1） */
export function computeSetBonus(): number {
  return 1;
}

/** 某稀有度常规款中已收藏的款数 */
export function tierOwned(state: GameState, rarity: Rarity): number {
  return gamesByRarity(rarity).filter(g => (state.owned[g.id]?.count ?? 0) > 0).length;
}

/** 该稀有度是否已解锁某宝购买（集齐上一级全部常规款；隐藏款不计入） */
export function tierUnlocked(state: GameState, rarity: Rarity): boolean {
  const i = ['N', 'R', 'SR', 'SSR'].indexOf(rarity);
  if (i <= 0) return true;
  const prev = ['N', 'R', 'SR', 'SSR'][i - 1] as Rarity;
  return tierOwned(state, prev) >= gamesByRarity(prev).length;
}

/** 是否已精通（不再出现在某鱼货源中） */
export function isMastered(state: GameState, id: string): boolean {
  const o = state.owned[id];
  if (!o) return false;
  return o.prof >= MASTERY[gameById(id).rarity];
}

/** 当前某宝货架应展示的稀有度：已解锁的最高级 */
export function currentTier(state: GameState): Rarity {
  let cur: Rarity = 'N';
  for (const t of ['N', 'R', 'SR', 'SSR'] as Rarity[]) {
    if (tierUnlocked(state, t)) cur = t;
  }
  return cur;
}
