import {
  PERKS,
  PRESTIGE_FIRST_GAIN,
  PRESTIGE_GAIN_MULT,
  PRESTIGE_HIDDEN_BONUS,
  PRESTIGE_KIND_EVERY,
  PRESTIGE_UNLOCK_BASE,
  PRESTIGE_UNLOCK_RATIO,
  PRESTIGE_WEIGHT,
} from '../data/prestige';
import type { PerkDef, PerkKey } from '../data/prestige';
import { GAMES, REGULAR_GAMES } from '../data/games';
import type { GameState } from '../state';
import { isMastered, kindCount } from './collection';

/** 指定天赋的当前等级 */
export function perkLevel(state: GameState, id: string): number {
  return state.prestige.perks[id] ?? 0;
}

/** 按效果键取等级（一个 key 只对应一个天赋；新天赋在 data/prestige.ts 登记即可） */
export function perkLv(state: GameState, key: PerkKey): number {
  for (const p of PERKS) if (p.key === key) return state.prestige.perks[p.id] ?? 0;
  return 0;
}

/** 下一级价格 = base + step × 当前等级 */
export function perkCost(def: PerkDef, curLv: number): number {
  return def.base + def.step * curLv;
}

/** 前置是否满足：无前置 = 线首永远可点；否则需前置天赋 ≥1 级 */
export function perkPrereqMet(state: GameState, def: PerkDef): boolean {
  if (!def.after) return true;
  return perkLevel(state, def.after) >= 1;
}

/** 已投入的阅历总额（洗点返还；跳过未知天赋 id，兼容旧档脏数据） */
export function insightSpent(state: GameState): number {
  let n = 0;
  for (const [id, lv] of Object.entries(state.prestige.perks)) {
    const def = PERKS.find(p => p.id === id);
    if (!def) continue;
    for (let i = 0; i < lv; i++) n += perkCost(def, i);
  }
  return n;
}

/** 已精通桌游数（遍历游戏清单而非存档键，天然兼容清单增删） */
export function masteredCount(state: GameState): number {
  return GAMES.filter(g => isMastered(state, g.id)).length;
}

/**
 * 转生权重：精通按稀有度计（隐藏款额外加成）+ 图鉴数量加成。
 * 全部从 GAMES 清单与稀有度推导，桌游增减/改稀有度无需改动。
 */
export function prestigeWeight(state: GameState): number {
  let w = 0;
  for (const g of GAMES) {
    if (isMastered(state, g.id)) w += PRESTIGE_WEIGHT[g.rarity] + (g.hidden ? PRESTIGE_HIDDEN_BONUS : 0);
  }
  w += Math.floor(kindCount(state) / PRESTIGE_KIND_EVERY);
  return w;
}

/** 解锁转生所需的精通数：基础值与常规款总数按比例伸缩，取较大者 */
export function prestigeUnlockCount(): number {
  return Math.max(PRESTIGE_UNLOCK_BASE, Math.ceil(REGULAR_GAMES.length * PRESTIGE_UNLOCK_RATIO));
}

export function canPrestige(state: GameState): boolean {
  return masteredCount(state) >= prestigeUnlockCount();
}

/**
 * 本次退坑可获阅历 = round(sqrt(权重) × 系数)，
 * 首转保底 FIRST_GAIN，之后每周目至少比上周目多 1（防越转越慢卡住）。
 */
export function insightGain(state: GameState): number {
  if (!canPrestige(state)) return 0;
  const base = Math.round(Math.sqrt(prestigeWeight(state)) * PRESTIGE_GAIN_MULT);
  const floor = state.prestige.runs === 0 ? PRESTIGE_FIRST_GAIN : state.prestige.lastGain + 1;
  return Math.max(base, floor);
}
