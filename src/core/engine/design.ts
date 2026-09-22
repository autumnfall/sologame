import {
  CROWD_DAYS_MAX, CROWD_DAYS_MIN, CROWD_GOAL_MAX, CROWD_GOAL_MIN,
  CROWD_SUCCESS_LIMIT, DAY_SECONDS, DESIGN_DIMS, FOUND_COST, INSPIRE_CAP,
  ITER_MAX, PRICE_RATIO_MAX, PRICE_RATIO_MIN, THEMES, iterCost, rarityOf, scaleById, themeById,
} from '../data/designs';
import type { Game } from '../data/types';
import type { GameState } from '../state';
import { costPriceOf, demandProb, inspireGain, qualityOf } from '../mechanics/design';

export type DesignResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

function ok(message: string): DesignResult {
  return { ok: true, message };
}

function fail(reason: string): DesignResult {
  return { ok: false, reason };
}

function emptyIter(): Record<string, number> {
  return Object.fromEntries(DESIGN_DIMS.map(d => [d.key, 0]));
}

/** 结算一局游玩的灵感入账（settleRound 挂钩；未解锁不加；cap 999） */
export function gainInspiration(state: GameState, g: Game): number {
  if (!state.designer.unlocked) return 0;
  const amt = inspireGain(state, g);
  const before = state.designer.inspiration;
  state.designer.inspiration = Math.min(INSPIRE_CAP, before + amt);
  return state.designer.inspiration - before;
}

/**
 * 立项：名称（2~10 字）+ 类型（主题）+ 体量，花 10 灵感生成原型（6 维度迭代全 0）。
 */
export function foundPrototype(state: GameState, name: string, themeId: string, scale: string): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 10) return fail('名称需 2~10 字');
  try {
    themeById(themeId);
  } catch {
    return fail('未知类型');
  }
  try {
    scaleById(scale);
  } catch {
    return fail('未知体量');
  }
  if (state.designer.inspiration < FOUND_COST) return fail(`灵感不够（立项需要 ${FOUND_COST}）`);
  state.designer.inspiration -= FOUND_COST;
  const uid = state.designer.nextUid++;
  state.designer.prototypes.push({ uid, name: trimmed, themeId, scale, iter: emptyIter() });
  return ok(`已立项《${trimmed}》（${themeById(themeId).name}·${scaleById(scale).name}），开始打磨 6 个设计维度吧`);
}

/**
 * 迭代原型维度：第 n 次花 5n 灵感；增益 = 2+floor(0.4×属性等级)+主场+1（属性永不消耗）。
 */
export function iterateProto(state: GameState, protoUid: number, dimKey: string): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const proto = state.designer.prototypes.find(p => p.uid === protoUid);
  if (!proto) return fail('原型不存在（可能已在众筹中）');
  if (!DESIGN_DIMS.some(d => d.key === dimKey)) return fail('未知维度');
  const cur = proto.iter[dimKey] ?? 0;
  if (cur >= ITER_MAX) return fail('该维度已打磨至极限');
  const cost = iterCost(cur + 1);
  if (state.designer.inspiration < cost) return fail(`灵感不够（本次迭代需要 ${cost}）`);
  state.designer.inspiration -= cost;
  proto.iter[dimKey] = cur + 1;
  const dim = DESIGN_DIMS.find(d => d.key === dimKey)!;
  return ok(`「${dim.name}」第 ${cur + 1} 次打磨完成（-${cost} 灵感）`);
}

/**
 * 发起众筹：锁定 Q/稀有度/成本价，售价 = round(成本价 × 定价倍率)，原型转入进行中（不可再迭代）。
 * 众筹成功满 10 款后预留出版玩法，拒绝再发起。
 */
export function launchCrowd(state: GameState, protoUid: number, goal: number, days: number, ratio: number): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  if (state.designer.successCount >= CROWD_SUCCESS_LIMIT) {
    return fail('众筹成功已满 10 款，出版玩法将在后续版本开放');
  }
  const idx = state.designer.prototypes.findIndex(p => p.uid === protoUid);
  if (idx < 0) return fail('原型不存在');
  if (!Number.isInteger(goal) || goal < CROWD_GOAL_MIN || goal > CROWD_GOAL_MAX) {
    return fail(`目标人数需在 ${CROWD_GOAL_MIN}~${CROWD_GOAL_MAX} 之间`);
  }
  if (!Number.isInteger(days) || days < CROWD_DAYS_MIN || days > CROWD_DAYS_MAX) {
    return fail(`期限需在 ${CROWD_DAYS_MIN}~${CROWD_DAYS_MAX} 天之间`);
  }
  const r = Math.round(ratio * 100) / 100;
  if (r < PRICE_RATIO_MIN || r > PRICE_RATIO_MAX) return fail('定价需在成本价的 100%~1000% 之间');
  const proto = state.designer.prototypes[idx];
  const score = qualityOf(state, proto);
  const rarity = rarityOf(score);
  const costPrice = costPriceOf(score, proto.scale);
  const price = Math.max(1, Math.round(costPrice * r));
  state.designer.prototypes.splice(idx, 1);
  state.designer.campaigns.push({
    uid: proto.uid, name: proto.name, themeId: proto.themeId, scale: proto.scale,
    score, rarity, costPrice, price, goal, days, elapsedSec: 0, supporters: 0, iter: proto.iter,
  });
  return ok(`《${proto.name}》已发起众筹：目标 ${goal} 人 / ${days} 天，售价 ¥${price}（Q${score}·${rarity}）`);
}

export interface CrowdSettleEvent {
  name: string;
  ok: boolean;
  supporters: number;
  /** 成功：垫资成本（支持 × 成本价）；失败为 0 */
  cost: number;
  /** 成功：货款收入（支持 × 售价） */
  income: number;
}

/** 单秒需求模拟：返回本秒新增支持人数 */
function crowdSecond(state: GameState, c: { themeId: string; price: number; costPrice: number; rarity: import('../data/types').Rarity; supporters: number }, rng: () => number): number {
  // 基础关注人数 1~5 + floor(支持/100)，上限 10
  let k = 1 + Math.floor(rng() * 5) + Math.floor(c.supporters / 100);
  k = Math.min(10, k);
  let gain = 0;
  for (let j = 0; j < k; j++) {
    // 随机两个钟意题材
    const f1 = THEMES[Math.floor(rng() * THEMES.length)].id;
    const f2 = THEMES[Math.floor(rng() * THEMES.length)].id;
    if (rng() < demandProb(state, c, f1, f2)) gain++;
  }
  return gain;
}

/**
 * 众筹逐秒推进（在线每 tick 调用；离线 accumulateOffline 复用本函数累计，上限沿用离线 1h）。
 * 到期结算：达标 → 成功（successCount+1、进 funded 待交付，钱不动，交付见 deliverDesign）；
 * 未达标 → 失败：原型退回、进 failed。提前满额不提前结束，继续累积至到期。
 */
export function tickCrowd(state: GameState, rng: () => number = Math.random, secs = 1): CrowdSettleEvent[] {
  const events: CrowdSettleEvent[] = [];
  if (!state.designer.unlocked || secs <= 0) return events;
  for (let i = state.designer.campaigns.length - 1; i >= 0; i--) {
    const c = state.designer.campaigns[i];
    const total = c.days * DAY_SECONDS;
    const run = Math.max(0, Math.min(secs, total - c.elapsedSec));
    for (let s = 0; s < run; s++) {
      c.supporters += crowdSecond(state, c, rng);
    }
    c.elapsedSec += run;
    if (c.elapsedSec < total) continue;
    state.designer.campaigns.splice(i, 1);
    if (c.supporters >= c.goal) {
      const income = c.supporters * c.price;
      const cost = c.supporters * c.costPrice;
      state.designer.successCount++;
      state.designer.funded.push({
        uid: c.uid, name: c.name, score: c.score, rarity: c.rarity,
        price: c.price, supporters: c.supporters, income, cost, delivered: false,
      });
      events.push({ name: c.name, ok: true, supporters: c.supporters, cost, income });
    } else {
      // 失败：原型退回（iter 保持发起时锁定值，可调整后再发起）
      state.designer.failed.push({ uid: c.uid, name: c.name, goal: c.goal, days: c.days, supporters: c.supporters });
      state.designer.prototypes.push({
        uid: c.uid, name: c.name, themeId: c.themeId, scale: c.scale, iter: c.iter,
      });
      events.push({ name: c.name, ok: false, supporters: c.supporters, cost: 0, income: 0 });
    }
  }
  return events;
}

/**
 * 交付已众筹成功的设计：垫资成本（money −= cost）后收货款（money += income），
 * 净入账 支持 ×(售价−成本价)（可为负 = 亏损，允许）。交付后 delivered 置 true，不可重复交付。
 */
export function deliverDesign(state: GameState, fundedUid: number): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const f = state.designer.funded.find(x => x.uid === fundedUid);
  if (!f) return fail('项目不存在');
  if (f.delivered) return fail('该项目已交付');
  if (state.money < f.cost) return fail(`交付需垫资 ¥${f.cost}，资金不足`);
  state.money -= f.cost;
  state.money += f.income;
  f.delivered = true;
  const net = f.income - f.cost;
  return ok(net >= 0
    ? `《${f.name}》交付完成：垫资 ¥${f.cost} → 货款 ¥${f.income}，净收益 +¥${net}`
    : `《${f.name}》交付完成：垫资 ¥${f.cost} → 货款 ¥${f.income}，亏损 ¥${-net}`);
}
