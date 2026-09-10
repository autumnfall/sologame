import type { Attr } from '../data/constants';
import { SELL_FEE } from '../data/balance';
import { jobById } from '../data/jobs';
import type { Job } from '../data/types';
import type { GameState } from '../state';
import { attrLevel } from './attrs';
import { computeSetBonus, globalBonus, hasAffix } from './collection';

// ---------- 六维属性效果（全部为乘区，便于控制平衡） ----------
// 谋略：游玩经验 +2.5%/级  演算：游玩时间 -2%/级（下限 ×0.80）
// 应变：疲劳增长 -4%/级（下限 ×0.60）  运筹：某鱼砍价 -2%/级（下限 ×0.80）、手续费 -0.5%/级（10 级全免）
// 洞察：掉券率 +10%/级、时机条金区 +2%/级宽（上限 40%）  沉浸：游玩收入 +4%/级、主播下限上移

/** 游玩经验倍率 = 图鉴加成 × 谋略 × 隐藏款词条 × 套装 */
export function expMult(state: GameState): number {
  return (1 + globalBonus(state)) * (1 + 0.025 * attrLevel(state, '谋略'))
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

/** 某鱼成交手续费率（运筹每级 -0.5%，10 级全免；四舍五入到 0.01% 避免浮点尾巴） */
export function sellFeeRate(state: GameState): number {
  return Math.max(0, Math.round((SELL_FEE - 0.005 * attrLevel(state, '运筹')) * 10000) / 10000);
}

/** 游玩收入倍率（沉浸；只作用于游玩结算，不影响工作周期酬劳） */
export function incomeMult(state: GameState): number {
  return 1 + 0.04 * attrLevel(state, '沉浸');
}

/** 抽赏券掉率倍率（洞察 +10%/级 × 隐藏款词条） */
export function ticketRateMult(state: GameState): number {
  return (1 + 0.10 * attrLevel(state, '洞察')) * (hasAffix(state, 'ticketUp') ? 1.25 : 1);
}

/** 时机条金色区宽度（基础 14%，洞察每级 +2%，上限 40%） */
export function goldZoneWidth(state: GameState): number {
  return Math.min(40, 14 + 2 * attrLevel(state, '洞察'));
}

/**
 * 主播带货的波动乘区：沉浸每级提高下限 5%（0.5→最高 0.9），上限 1.5 不变。
 * rng 注入便于测试：返回 lb + rng×(1.5−lb)。
 */
export function streamerMult(state: GameState, rng: () => number = Math.random): number {
  const lb = Math.min(0.9, 0.5 + 0.05 * attrLevel(state, '沉浸'));
  return lb + rng() * (1.5 - lb);
}

/** 当前职业一个周期的酬劳（主播按波动掷；期望 = cyclePay × (沉浸 0 级时 1.0)） */
export function jobCyclePay(state: GameState, job: Job, rng: () => number = Math.random): number {
  let pay = job.cyclePay;
  if (job.volatile) pay *= streamerMult(state, rng);
  return Math.round(pay);
}

/** 主播周期酬劳的期望（离线累积用） */
export function jobCyclePayExpected(state: GameState, job: Job): number {
  if (!job.volatile) return job.cyclePay;
  const lb = Math.min(0.9, 0.5 + 0.05 * attrLevel(state, '沉浸'));
  return job.cyclePay * (lb + 1.5) / 2;
}

/** 当前在岗职业（无则 undefined） */
export function currentJob(state: GameState): Job | undefined {
  return state.job ? jobById(state.job) : undefined;
}
