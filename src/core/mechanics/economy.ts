import type { Attr } from '../data/constants';
import { jobById } from '../data/jobs';
import type { GameState } from '../state';
import { attrLevel } from './attrs';
import { computeSetBonus, globalBonus, hasAffix } from './collection';

// ---------- 六维属性效果（全部为乘区，便于控制平衡） ----------
// 谋略：游玩经验 +3%/级  演算：游玩时间 -2%/级（下限 ×0.80）
// 应变：疲劳增长 -4%/级（下限 ×0.60）  运筹：某鱼砍价 -2%/级（下限 ×0.80）
// 洞察：掉券率 +20%/级、时机条金区 +1%/级宽  沉浸：工作/游玩收入 +4%/级、主播下限上移

/** 游玩经验倍率 = 图鉴加成 × 谋略 × 隐藏款词条 × 套装 */
export function expMult(state: GameState): number {
  return (1 + globalBonus(state)) * (1 + 0.03 * attrLevel(state, '谋略'))
    * (hasAffix(state, 'expAll') ? 1.05 : 1) * computeSetBonus();
}

/** 疲劳增长倍率（应变，下限 ×0.60） */
export function fatigueIncMult(state: GameState): number {
  return Math.max(0.60, 1 - 0.04 * attrLevel(state, '应变' as Attr));
}

/** 某鱼价格倍率（运筹砍价，下限 ×0.80） */
export function xyPriceMult(state: GameState): number {
  return Math.max(0.80, 1 - 0.02 * attrLevel(state, '运筹'));
}

/** 收入倍率（沉浸） */
export function incomeMult(state: GameState): number {
  return 1 + 0.04 * attrLevel(state, '沉浸');
}

/** 抽赏券掉率倍率（洞察 × 隐藏款词条） */
export function ticketRateMult(state: GameState): number {
  return (1 + 0.20 * attrLevel(state, '洞察')) * (hasAffix(state, 'ticketUp') ? 1.25 : 1);
}

/** 时机条金色区宽度（基础 14%，洞察每级 +1%） */
export function goldZoneWidth(state: GameState): number {
  return 14 + attrLevel(state, '洞察');
}

/**
 * 当前职业的实际秒收入（元/秒）。
 * 主播带货为波动收入：沉浸每级提高下限 5%（0.5→最高 0.9），上限 1.5 不变；
 * rng 可注入随机数（默认 Math.random），便于测试。
 */
export function currentJobRate(state: GameState, rng: () => number = Math.random): number {
  const j = state.job ? jobById(state.job) : undefined;
  if (!j || !j.auto) return 0;
  let r = j.rate * (1 + globalBonus(state)) * incomeMult(state);
  if (j.volatile) {
    const lb = Math.min(0.9, 0.5 + 0.05 * attrLevel(state, '沉浸'));
    r *= lb + rng() * (1.5 - lb);
  }
  return r;
}
