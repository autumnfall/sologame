import { ACHIEVEMENTS, FEATURE_UNLOCKS } from '../data/achievements';
import type { AchievementDef, FeatureKey } from '../data/achievements';
import { isMastered } from './collection';
import { isDesignedId } from '../state';
import type { GameState } from '../state';

/** 已达成成就数 */
export function achievedCount(state: GameState): number {
  return state.achievements.length;
}

/** 全局经验加成：每个成就 +1%，无上限 */
export function achievementExpMult(state: GameState): number {
  return 1 + 0.01 * achievedCount(state);
}

/** 功能是否已按里程碑解锁 */
export function isFeatureUnlocked(state: GameState, key: FeatureKey): boolean {
  const def = FEATURE_UNLOCKS.find(f => f.key === key);
  return !!def && achievedCount(state) >= def.need;
}

/**
 * 扫描成就：把新达成的写入 state.achievements 并返回（用于弹提示）。
 * 每秒 tick 调用一次即可；全部为轻量推导，也可在关键操作后立即调用。
 */
export function checkAchievements(state: GameState): AchievementDef[] {
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    if (a.check(state)) {
      state.achievements.push(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}

/**
 * 自动更换目标：mode = fatigue 挑「未疲劳（<7）」的收藏；mode = mastery 挑「未精通」的。
 * 排除当前游戏；无候选返回 null（调用方维持当前游戏）。
 */
export function autoSwitchTarget(
  state: GameState,
  mode: 'fatigue' | 'mastery',
  excludeId: string,
  rng: () => number = Math.random,
): string | null {
  const cand = Object.keys(state.collections).filter(id => {
    if (id === excludeId || isDesignedId(id)) return false; // 自创设计不可游玩
    const c = state.collections[id];
    if (!c.firstOpened) return false;
    if (state.copies.filter(x => x.gameId === id && !state.listings.some(l => l.copyUid === x.uid)).length === 0) return false;
    return mode === 'fatigue' ? c.fatigue < 7 : !isMastered(state, id);
  });
  if (!cand.length) return null;
  return cand[Math.floor(rng() * cand.length)];
}
