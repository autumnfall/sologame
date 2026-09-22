import { GLOBAL_PER_KIND, GLOBAL_SOFTCAP, MASTERY } from '../data/constants';
import { PERKS } from '../data/prestige';
import type { Rarity } from '../data/types';
import { gamesByRarity } from '../data/games';
import { gameById } from '../data/games';
import type { AffixType } from '../data/types';
import type { GameState } from '../state';
import { isDesignedId } from '../state';

/** 已收藏的桌游种数（firstOpened，含隐藏款；实体卖光后收藏进度仍保留；不含自创设计） */
export function kindCount(state: GameState): number {
  return Object.entries(state.collections)
    .filter(([id, c]) => !isDesignedId(id) && c.firstOpened).length;
}

/**
 * 图鉴加成：每多一种桌游全属性经验 +1.5%（软上限 +50%，超出部分 ×0.1 递减）。
 * 游玩经验与工作收入均受它影响。
 */
export function globalBonus(state: GameState): number {
  const raw = kindCount(state) * GLOBAL_PER_KIND;
  return raw <= GLOBAL_SOFTCAP ? raw : GLOBAL_SOFTCAP + (raw - GLOBAL_SOFTCAP) * 0.1;
}

/** 是否拥有指定类型的隐藏款词条（词条随收藏永久生效，与实体去留无关；自创设计无词条） */
export function hasAffix(state: GameState, type: AffixType): boolean {
  return Object.keys(state.collections).some(
    id => !isDesignedId(id) && state.collections[id].firstOpened && gameById(id).affix?.type === type,
  );
}

/** EXT: 标签共鸣套装加成（占位，当前恒为 1） */
export function computeSetBonus(): number {
  return 1;
}

/** 某稀有度常规款中已开箱的款数 */
export function tierOwned(state: GameState, rarity: Rarity): number {
  return gamesByRarity(rarity).filter(g => state.collections[g.id]?.firstOpened === true).length;
}

/** 该稀有度是否已解锁某宝购买（集齐上一级全部常规款；隐藏款不计入） */
export function tierUnlocked(state: GameState, rarity: Rarity): boolean {
  const i = ['N', 'R', 'SR', 'SSR'].indexOf(rarity);
  if (i <= 0) return true;
  const prev = ['N', 'R', 'SR', 'SSR'][i - 1] as Rarity;
  return tierOwned(state, prev) >= gamesByRarity(prev).length;
}

/**
 * 精通所需局数（收藏家之眼：-20%）。
 * 用 data 层的 PERKS 查等级而非 mechanics/prestige 的 perkLv，避免模块循环依赖。
 */
export function masteryNeed(state: GameState, rarity: Rarity): number {
  const def = PERKS.find(p => p.key === 'masteryCut');
  const cut = def ? (state.prestige.perks[def.id] ?? 0) : 0;
  return Math.max(1, Math.ceil(MASTERY[rarity] * (cut > 0 ? 0.8 : 1)));
}

/** 是否已精通（不再出现在某鱼货源中） */
export function isMastered(state: GameState, id: string): boolean {
  const c = state.collections[id];
  if (!c) return false;
  return c.prof >= masteryNeed(state, gameById(id).rarity);
}

/** 当前某宝货架应展示的稀有度：已解锁的最高级 */
export function currentTier(state: GameState): Rarity {
  let cur: Rarity = 'N';
  for (const t of ['N', 'R', 'SR', 'SSR'] as Rarity[]) {
    if (tierUnlocked(state, t)) cur = t;
  }
  return cur;
}
