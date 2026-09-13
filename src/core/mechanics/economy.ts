import type { Attr } from '../data/constants';
import { SELL_FEE } from '../data/balance';
import { jobById } from '../data/jobs';
import { taobaoBase } from '../data/prices';
import type { Game, Job } from '../data/types';
import type { GameState } from '../state';
import { attrLevel } from './attrs';
import { computeSetBonus, globalBonus, hasAffix } from './collection';
import { achievementExpMult } from './achievements';
import { perkLv } from './prestige';

// ---------- 六维属性效果（全部为乘区，便于控制平衡） ----------
// 谋略：游玩经验 +2.5%/级  演算：游玩时间 -2%/级（下限 ×0.80）
// 沉浸：游玩疲劳增长 -4%/级（下限 ×0.60）  运筹：某鱼砍价 -2%/级（下限 ×0.80）、手续费 -0.5%/级（10 级全免）
// 洞察：掉券率 +10%/级、时机条金区 +2%/级宽（上限 40%）  应变：工作酬劳 +4%/级、主播酬劳下限上移

/** 游玩经验倍率 = 图鉴加成 × 谋略 × 隐藏款词条 × 套装 × 触类旁通 × 成就 */
export function expMult(state: GameState): number {
  return (1 + globalBonus(state)) * (1 + 0.025 * attrLevel(state, '谋略'))
    * (hasAffix(state, 'expAll') ? 1.05 : 1) * computeSetBonus()
    * Math.pow(1.1, perkLv(state, 'expAll')) * achievementExpMult(state);
}

/** 疲劳增长倍率（沉浸先过 0.60 地板，科学作息在地板之后再乘——永远生效） */
export function fatigueIncMult(state: GameState): number {
  return Math.max(0.60, 1 - 0.04 * attrLevel(state, '沉浸' as Attr)) * Math.pow(0.9, perkLv(state, 'fatigueCut'));
}

/** 某鱼价格倍率（运筹砍价，下限 ×0.80） */
export function xyPriceMult(state: GameState): number {
  return Math.max(0.80, 1 - 0.02 * attrLevel(state, '运筹'));
}

/** 某鱼成交手续费率（运筹每级 -0.5%，10 级全免；四舍五入到 0.01% 避免浮点尾巴） */
export function sellFeeRate(state: GameState): number {
  return Math.max(0, Math.round((SELL_FEE - 0.005 * attrLevel(state, '运筹')) * 10000) / 10000);
}

/** 工作酬劳倍率（应变；作用于所有职业周期酬劳，含离线折算） */
export function incomeMult(state: GameState): number {
  return 1 + 0.04 * attrLevel(state, '应变');
}

/** 抽赏券掉率倍率（洞察 × 隐藏款词条 × 欧气满满） */
export function ticketRateMult(state: GameState): number {
  return (1 + 0.10 * attrLevel(state, '洞察')) * (hasAffix(state, 'ticketUp') ? 1.25 : 1)
    * (1 + 0.25 * perkLv(state, 'ticketUp'));
}

/** 某宝实付价（基础价 × 会员折扣） */
export function taobaoPrice(state: GameState, g: Game): number {
  return Math.max(1, Math.round(taobaoBase(g) * (1 - 0.05 * perkLv(state, 'tbDiscount'))));
}

/** 时机条金色区宽度（基础 14%，洞察每级 +2%，上限 40%） */
export function goldZoneWidth(state: GameState): number {
  return Math.min(40, 14 + 2 * attrLevel(state, '洞察'));
}

/** 心流自动命中概率：基础 20%，金区宽度每 +2%（洞察 1 级）再 +1%，上限 33% */
export function autoHitChance(state: GameState): number {
  return Math.min(0.33, 0.20 + Math.max(0, goldZoneWidth(state) - 14) * 0.005);
}

/**
 * 主播带货的波动乘区：应变每级提高下限 5%（0.5→最高 0.9），上限 1.5 不变。
 * rng 注入便于测试：返回 lb + rng×(1.5−lb)。
 */
export function streamerMult(state: GameState, rng: () => number = Math.random): number {
  const lb = Math.min(0.9, 0.5 + 0.05 * attrLevel(state, '应变'));
  return lb + rng() * (1.5 - lb);
}

/** 当前职业一个周期的酬劳（主播按波动掷；非主播 = cyclePay × 应变收入乘区） */
export function jobCyclePay(state: GameState, job: Job, rng: () => number = Math.random): number {
  let pay = job.cyclePay * incomeMult(state);
  if (job.volatile) pay *= streamerMult(state, rng);
  return Math.round(pay);
}

/** 主播周期酬劳的期望（离线累积用；应变同时影响波动下限与收入乘区） */
export function jobCyclePayExpected(state: GameState, job: Job): number {
  if (!job.volatile) return job.cyclePay * incomeMult(state);
  const lb = Math.min(0.9, 0.5 + 0.05 * attrLevel(state, '应变'));
  return job.cyclePay * incomeMult(state) * (lb + 1.5) / 2;
}

/** 当前在岗职业（无则 undefined） */
export function currentJob(state: GameState): Job | undefined {
  return state.job ? jobById(state.job) : undefined;
}
