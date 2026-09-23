import {
  ACTIVITY_DAILY_LIMIT, CROWD_DAYS_MAX, CROWD_DAYS_MIN, CROWD_GOAL_MAX,
  CROWD_GOAL_MIN, CROWD_SUCCESS_LIMIT,
  DAY_SECONDS, DESIGN_DIMS, DIARY_EXPOSURE, DIARY_INSPIRATION_COST, EVENT_CHANCE,
  EVENT_CHECK_SECONDS, EVENT_FINAL_DAYS, EVENT_WINDOW_SECONDS, FIRST_PAYMENT_RATIO,
  FOUND_COST, INSPIRE_CAP, ITER_MAX, MILESTONES, PLAYTEST_EXPOSURE_RANGE,
  PLAYTEST_SEED_RANGE, PREHEAT_MIN, PRICE_RATIO_MAX, PRICE_RATIO_MIN,
  PROMO_EXPOSURE_RANGE, THEMES, convertRate, eventById, iterCost, platformById,
  playtestCost, preheatMax, promoCost, rarityOf, scaleById, themeById,
} from '../data/designs';
import type { ActivityKey, EventOptionDef } from '../data/designs';
import type { Game } from '../data/types';
import type { DesignCampaign, GameState } from '../state';
import {
  addExposure, boostExposureGain, costPriceOf, demandProb, drawEvent,
  eventOptionCheck, inspireGain, playtestMult, priceAffinity, qualityMult,
  qualityOf, watcherDailyGain,
} from '../mechanics/design';

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

/** 结算事件（到期/失败） */
export interface CrowdSettleEvent {
  name: string;
  ok: boolean;
  supporters: number;
  /** 成功：垫资成本（支持 × 成本价） */
  cost: number;
  /** 成功：货款总额（支持 × 售价） */
  income: number;
  /** 成功：到期已到账 = round((income − 抽成) × 50%) */
  firstPayment: number;
  /** 成功：交付时收回的尾款 */
  remainPayment: number;
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
 * 立项：名称（2~10 字）+ 类型（主题）+ 体量，花 10 灵感生成原型（6 维迭代全 0，曝光/种子全 0）。
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
  state.designer.prototypes.push({
    uid, name: trimmed, themeId, scale, iter: emptyIter(),
    exposure: 0, seeds: 0,
    activities: { playtest: 0, promo: 0, diary: 0 },
    activityDay: -1, activityCount: { playtest: 0, promo: 0, diary: 0 },
  });
  return ok(`已立项《${trimmed}》（${themeById(themeId).name}·${scaleById(scale).name}），经营曝光或打磨维度都行`);
}

/**
 * 设计期经营 activity（曝光来源）：试玩/宣传每日各 3 次（游戏时间日 = 24 秒），设计日记由灵感限制。
 * 试玩：¥50×2ⁿ → 曝光 +8~15、看好种子 +0~3（沉浸/应变每级 +4% 产出）；宣传：¥30×1.6ⁿ → 曝光 +5~10；日记：灵感 3 → 曝光 +4。
 */
export function runActivity(
  state: GameState,
  protoUid: number,
  key: ActivityKey,
  rng: () => number = Math.random,
  now: number = Date.now(),
): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const proto = state.designer.prototypes.find(p => p.uid === protoUid);
  if (!proto) return fail('原型不存在（可能已在众筹中）');
  // 游戏时间日切换时重置每日次数（1 天 = 24 现实秒；now 为毫秒时间戳）
  const day = Math.floor(now / 1000 / DAY_SECONDS);
  if (proto.activityDay !== day) {
    proto.activityDay = day;
    proto.activityCount = { playtest: 0, promo: 0, diary: 0 };
  }
  if (key !== 'diary' && (proto.activityCount[key] ?? 0) >= ACTIVITY_DAILY_LIMIT) {
    return fail('今日次数已用完（每日 3 次，游戏时间 1 天 = 24 秒）');
  }
  const n = proto.activities[key] ?? 0;
  let message = '';
  if (key === 'playtest') {
    const cost = playtestCost(n);
    if (state.money < cost) return fail(`钱不够（需要 ¥${cost}）`);
    state.money -= cost;
    const mult = playtestMult(state);
    const expo = Math.round((PLAYTEST_EXPOSURE_RANGE[0] + Math.floor(rng() * (PLAYTEST_EXPOSURE_RANGE[1] - PLAYTEST_EXPOSURE_RANGE[0] + 1))) * mult);
    const seed = Math.round((PLAYTEST_SEED_RANGE[0] + Math.floor(rng() * (PLAYTEST_SEED_RANGE[1] - PLAYTEST_SEED_RANGE[0] + 1))) * mult);
    proto.exposure = addExposure(proto.exposure, expo);
    proto.seeds += seed;
    message = `试玩会办完了：曝光 +${expo}、看好种子 +${seed}`;
  } else if (key === 'promo') {
    const cost = promoCost(n);
    if (state.money < cost) return fail(`钱不够（需要 ¥${cost}）`);
    state.money -= cost;
    const expo = PROMO_EXPOSURE_RANGE[0] + Math.floor(rng() * (PROMO_EXPOSURE_RANGE[1] - PROMO_EXPOSURE_RANGE[0] + 1));
    proto.exposure = addExposure(proto.exposure, expo);
    message = `社媒宣传投放了：曝光 +${expo}`;
  } else {
    if (state.designer.inspiration < DIARY_INSPIRATION_COST) return fail(`灵感不够（需要 ${DIARY_INSPIRATION_COST}）`);
    state.designer.inspiration -= DIARY_INSPIRATION_COST;
    proto.exposure = addExposure(proto.exposure, DIARY_EXPOSURE);
    message = `设计日记更新：曝光 +${DIARY_EXPOSURE}`;
  }
  proto.activities[key] = n + 1;
  if (key !== 'diary') proto.activityCount[key] = (proto.activityCount[key] ?? 0) + 1;
  return ok(message);
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
 * 发起预热：选平台（不可更换）+ 总期限 T（含预热）+ 预热 P 天 + 定价倍率，锁 Q/稀有度/成本价/售价。
 * 原型带入曝光与看好种子；众筹成功满 10 款后预留出版玩法。
 */
export function startPreheat(
  state: GameState,
  protoUid: number,
  platformId: string,
  goal: number,
  days: number,
  preheatDays: number,
  ratio: number,
): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  if (state.designer.successCount >= CROWD_SUCCESS_LIMIT) {
    return fail('众筹成功已满 10 款，出版玩法将在后续版本开放');
  }
  const idx = state.designer.prototypes.findIndex(p => p.uid === protoUid);
  if (idx < 0) return fail('原型不存在');
  let platform;
  try {
    platform = platformById(platformId);
  } catch {
    return fail('未知平台');
  }
  if (!Number.isInteger(goal) || goal < CROWD_GOAL_MIN || goal > CROWD_GOAL_MAX) {
    return fail(`目标人数需在 ${CROWD_GOAL_MIN}~${CROWD_GOAL_MAX} 之间`);
  }
  if (!Number.isInteger(days) || days < CROWD_DAYS_MIN || days > CROWD_DAYS_MAX) {
    return fail(`总期限需在 ${CROWD_DAYS_MIN}~${CROWD_DAYS_MAX} 天之间`);
  }
  const pMax = preheatMax(days);
  if (!Number.isInteger(preheatDays) || preheatDays < PREHEAT_MIN || preheatDays > pMax) {
    return fail(`预热天数需在 ${PREHEAT_MIN}~${pMax} 天之间（众筹至少留 15 天）`);
  }
  const r = Math.round(ratio * 100) / 100;
  if (r < PRICE_RATIO_MIN || r > PRICE_RATIO_MAX) return fail('定价需在成本价的 100%~1000% 之间');
  const proto = state.designer.prototypes[idx];
  const score = qualityOf(state, proto);
  const costPrice = costPriceOf(score, proto.scale);
  const price = Math.max(1, Math.round(costPrice * r));
  state.designer.prototypes.splice(idx, 1);
  state.designer.campaigns.push({
    uid: proto.uid, name: proto.name, themeId: proto.themeId, scale: proto.scale,
    score, rarity: rarityOf(score), costPrice, price,
    goal, days, preheatDays, platformId, status: 'preheat',
    watchers: proto.seeds, exposure: proto.exposure, watchersDays: 0,
    convertRate: 0, elapsedSec: 0, supporters: 0, flowMult: 1, eventTimer: 0,
    usedEvents: [], pendingEvents: [], eventHistory: [], milestonesHit: [], boostCount: 0,
    iter: proto.iter,
  });
  return ok(`《${proto.name}》登陆${platform.name}开始预热：${preheatDays} 天攒人气，随后 ${days - preheatDays} 天众筹（目标 ${goal} 人，售价 ¥${price}，Q${score}·${rarityOf(score)}）`);
}

/** 预热期追加宣传：花金钱买曝光（成本递增），按剩余预热天数折算看好 */
export function boostCampaign(state: GameState, campaignUid: number, rng: () => number = Math.random): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const c = state.designer.campaigns.find(x => x.uid === campaignUid);
  if (!c) return fail('项目不存在');
  if (c.status !== 'preheat') return fail('只有预热期可以追加宣传');
  const cost = promoCost(c.boostCount);
  if (state.money < cost) return fail(`钱不够（需要 ¥${cost}）`);
  state.money -= cost;
  const gain = boostExposureGain(rng);
  c.exposure = addExposure(c.exposure, gain);
  const remainingDays = Math.max(0, c.preheatDays - c.watchersDays);
  const ratio = c.price / Math.max(1, c.costPrice);
  // 折算看好：新增曝光/10 × 定价亲和 × 质量系数 × 剩余预热天数
  const delta = Math.round((gain / 10) * priceAffinity(ratio) * qualityMult(c.score) * remainingDays);
  c.watchers += delta;
  c.boostCount++;
  return ok(`追加宣传：曝光 +${gain}，按剩余 ${remainingDays} 天折算看好 +${delta}`);
}

/** 应用事件结果，返回结果描述 */
function applyEventResult(c: DesignCampaign, opt: EventOptionDef, rng: () => number): string {
  const parts: string[] = [];
  if (opt.supportersPct) {
    const delta = Math.round(c.supporters * opt.supportersPct);
    c.supporters = Math.max(0, c.supporters + delta);
    parts.push(`支持${delta >= 0 ? '+' : ''}${delta}`);
  }
  if (opt.flowBonus) {
    if (opt.flowGamble) {
      if (rng() < 0.5) {
        c.flowMult *= 1 + opt.flowBonus;
        parts.push(`流量+${Math.round(opt.flowBonus * 100)}%（命中）`);
      } else {
        parts.push('竞拍落空');
      }
    } else {
      c.flowMult *= 1 + opt.flowBonus;
      parts.push(`流量+${Math.round(opt.flowBonus * 100)}%`);
    }
  }
  return parts.length ? parts.join('，') : '无变化';
}

function pushEventHistory(c: DesignCampaign, eventId: string, optionIdx: number, byDefault: boolean, result: string, kind: 'event' | 'milestone'): void {
  c.eventHistory.push({
    day: Math.floor(c.elapsedSec / DAY_SECONDS),
    eventId, optionIdx, byDefault, result, kind,
  });
}

/** 待决事件按默认选项自动结算（超时 / 终局前 5 天） */
function autoResolveEvent(c: DesignCampaign, idx: number): void {
  const pending = c.pendingEvents[idx];
  const def = eventById(pending.eventId);
  const optIdx = def.options.findIndex(o => o.isDefault);
  const opt = def.options[optIdx];
  const result = applyEventResult(c, opt, () => 1); // 默认选项不耗资源、无赌博
  c.pendingEvents.splice(idx, 1);
  pushEventHistory(c, def.id, optIdx, true, result, 'event');
}

/**
 * 主动抉择待决事件：校验需求（属性门槛 / 成交额百分比 / 灵感），支付后应用结果。
 */
export function resolveEvent(
  state: GameState,
  campaignUid: number,
  pendingIdx: number,
  optionIdx: number,
  rng: () => number = Math.random,
): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const c = state.designer.campaigns.find(x => x.uid === campaignUid);
  if (!c) return fail('项目不存在');
  const pending = c.pendingEvents[pendingIdx];
  if (!pending) return fail('事件不存在或已结算');
  const def = eventById(pending.eventId);
  const opt = def.options[optionIdx];
  if (!opt) return fail('选项不存在');
  const check = eventOptionCheck(state, c, opt);
  if (!check.ok) return fail(check.reason);
  if (opt.moneyPct) state.money -= Math.round(c.supporters * c.price * opt.moneyPct);
  if (opt.inspiration) state.designer.inspiration -= opt.inspiration;
  const result = applyEventResult(c, opt, rng);
  c.pendingEvents.splice(pendingIdx, 1);
  pushEventHistory(c, def.id, optionIdx, false, result, 'event');
  return ok(`${def.name}：${opt.label} → ${result}`);
}

/** 单秒需求模拟：基础关注 1~5 + floor(支持/100)（上限 10），每人按需求概率判定；事件流量乘区作用于人数 */
function crowdSecond(state: GameState, c: DesignCampaign, rng: () => number): number {
  const base = 1 + Math.floor(rng() * 5) + Math.floor(c.supporters / 100);
  const k = Math.min(10, base);
  const eff = Math.max(k, Math.round(k * c.flowMult));
  let gain = 0;
  for (let j = 0; j < eff; j++) {
    const f1 = THEMES[Math.floor(rng() * THEMES.length)].id;
    const f2 = THEMES[Math.floor(rng() * THEMES.length)].id;
    if (rng() < demandProb(state, c, f1, f2)) gain++;
  }
  return gain;
}

/**
 * 众筹逐秒推进（状态机：preheat → live）。
 * 预热：逐日攒看好（曝光/10 + 平台基础曝光 × 亲和 × 质量系数）；满 P 天开众筹：看好 × 转化率转初始支持。
 * 众筹期：每 5 天 60% 生成事件（独立 5 天倒计时，超时/终局前 5 天按默认结算）+ 逐秒需求 + 里程碑解锁。
 * 到期：达标 → 到账 50%×(货款−抽成) 进 funded 待交付；未达标 → 原型退回。
 */
export function tickCrowd(state: GameState, rng: () => number = Math.random, secs = 1): CrowdSettleEvent[] {
  const events: CrowdSettleEvent[] = [];
  if (!state.designer.unlocked || secs <= 0) return events;
  for (let i = state.designer.campaigns.length - 1; i >= 0; i--) {
    const c = state.designer.campaigns[i];
    const total = c.days * DAY_SECONDS;
    const run = Math.max(0, Math.min(secs, total - c.elapsedSec));
    for (let s = 0; s < run; s++) {
      c.elapsedSec++;
      if (c.status === 'preheat') {
        const day = Math.floor(c.elapsedSec / DAY_SECONDS);
        while (c.watchersDays < Math.min(day, c.preheatDays)) {
          c.watchers += watcherDailyGain(c.exposure, c.platformId, c.price / Math.max(1, c.costPrice), c.score);
          c.watchersDays++;
        }
        if (c.elapsedSec >= c.preheatDays * DAY_SECONDS) {
          // 开众筹瞬间：看好 × 转化率转初始支持
          c.convertRate = convertRate(c.score, c.price / Math.max(1, c.costPrice));
          c.supporters = Math.floor(c.watchers * c.convertRate);
          c.status = 'live';
          c.eventTimer = 0;
        }
        continue;
      }
      // —— 众筹期（live）——
      const remainingDays = (c.days * DAY_SECONDS - c.elapsedSec) / DAY_SECONDS;
      // 待决事件倒计时（先于生成判定：新生成的事件从下一秒开始倒计时）
      for (let p = c.pendingEvents.length - 1; p >= 0; p--) {
        c.pendingEvents[p].remainingSec--;
        if (c.pendingEvents[p].remainingSec <= 0) autoResolveEvent(c, p);
      }
      // 事件判定：每 5 天 60% 生成（最多同时 3 个待决）
      c.eventTimer++;
      if (c.eventTimer >= EVENT_CHECK_SECONDS) {
        c.eventTimer -= EVENT_CHECK_SECONDS;
        if (rng() < EVENT_CHANCE && c.pendingEvents.length < 3) {
          const id = drawEvent(c.usedEvents, rng);
          c.usedEvents.push(id);
          c.pendingEvents.push({ eventId: id, remainingSec: EVENT_WINDOW_SECONDS });
        }
      }
      // 进入最后 5 天：所有待决按默认结算
      if (remainingDays <= EVENT_FINAL_DAYS) {
        while (c.pendingEvents.length) autoResolveEvent(c, c.pendingEvents.length - 1);
      }
      // 逐秒需求
      c.supporters += crowdSecond(state, c, rng);
      // 里程碑解锁：150% / 200% 目标自动 +3% / +5% 支持
      for (const m of MILESTONES) {
        const mark = Math.round(m.pct * 100);
        if (!c.milestonesHit.includes(mark) && c.supporters >= c.goal * m.pct) {
          c.milestonesHit.push(mark);
          const delta = Math.round(c.supporters * m.bonus);
          c.supporters += delta;
          pushEventHistory(c, `milestone-${mark}`, -1, true, `解锁回报：支持+${Math.round(m.bonus * 100)}%（+${delta} 人）`, 'milestone');
        }
      }
    }
    if (c.elapsedSec < total) continue;
    // 到期结算
    state.designer.campaigns.splice(i, 1);
    while (c.pendingEvents.length) autoResolveEvent(c, c.pendingEvents.length - 1);
    if (c.supporters >= c.goal) {
      const income = c.supporters * c.price;
      const commission = Math.round(income * platformById(c.platformId).commission);
      const firstPayment = Math.round((income - commission) * FIRST_PAYMENT_RATIO);
      const remainPayment = income - commission - firstPayment;
      const cost = c.supporters * c.costPrice;
      state.money += firstPayment; // 立即到账 50%×(货款−抽成)
      state.designer.successCount++;
      state.designer.funded.push({
        uid: c.uid, name: c.name, score: c.score, rarity: c.rarity,
        price: c.price, supporters: c.supporters, income, cost,
        commission, firstPayment, remainPayment, delivered: false,
      });
      events.push({ name: c.name, ok: true, supporters: c.supporters, cost, income, firstPayment, remainPayment });
    } else {
      state.designer.failed.push({ uid: c.uid, name: c.name, goal: c.goal, days: c.days, supporters: c.supporters });
      state.designer.prototypes.push({
        uid: c.uid, name: c.name, themeId: c.themeId, scale: c.scale, iter: c.iter,
        exposure: Math.round(c.exposure), seeds: 0,
        activities: { playtest: 0, promo: 0, diary: 0 }, activityDay: -1,
        activityCount: { playtest: 0, promo: 0, diary: 0 },
      });
      events.push({ name: c.name, ok: false, supporters: c.supporters, cost: 0, income: 0, firstPayment: 0, remainPayment: 0 });
    }
  }
  return events;
}

/**
 * 交付已众筹成功的设计：垫资成本（money −= cost），收回尾款 50%×(货款−抽成)（money += remainPayment）。
 * 净入账 = 支持×(售价×(1−抽成) − 成本价)，可为负（亏损允许）。交付后 delivered 置 true，不可重复交付。
 */
export function deliverDesign(state: GameState, fundedUid: number): DesignResult {
  if (!state.designer.unlocked) return fail('担任「桌游设计师」职业后解锁设计');
  const f = state.designer.funded.find(x => x.uid === fundedUid);
  if (!f) return fail('项目不存在');
  if (f.delivered) return fail('该项目已交付');
  if (state.money < f.cost) return fail(`交付需垫资 ¥${f.cost}，资金不足`);
  state.money -= f.cost;
  state.money += f.remainPayment;
  f.delivered = true;
  const net = f.income - f.commission - f.cost;
  return ok(net >= 0
    ? `《${f.name}》交付完成：垫资 ¥${f.cost} → 收尾款 ¥${f.remainPayment}（抽成 ¥${f.commission}），净收益 +¥${net}`
    : `《${f.name}》交付完成：垫资 ¥${f.cost} → 收尾款 ¥${f.remainPayment}（抽成 ¥${f.commission}），亏损 ¥${-net}`);
}
