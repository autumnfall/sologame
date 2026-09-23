import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_DAILY_LIMIT, DAY_SECONDS, EXPOSURE_SOFTCAP, PREHEAT_MIN, SAVE_VERSION,
  gameById, inspireCap, inspireGain,
  accumulateOffline, addExposure, boostCampaign, checkAchievements,
  convertRate, defaultState, demandParts, deliverDesign, doPrestige,
  foundPrototype, iterateProto, parseSave, playtestCost, promoCost,
  rarityOf, resolveEvent, runActivity, settleRound, startPreheat,
  takeJob, tickCrowd, watcherDailyGain, platformById, eventById, preheatMax,
} from '../src/core';
import type { DesignCampaign, GameState } from '../src/core';
import { expToReach, own, uidOf } from './helpers';

/** 解锁设计师（担任 master 职业） */
function unlocked(s: GameState): GameState {
  takeJob(s, 'master');
  return s;
}

/** 解锁 + 满灵感 + 立项 */
function found(s: GameState, name = '灵感方舟', themeId = 'euro', scale = 'standard') {
  s.designer.inspiration = 999;
  const r = foundPrototype(s, name, themeId, scale);
  if (!r.ok) throw new Error(`立项失败: ${r.reason}`);
  return s.designer.prototypes[s.designer.prototypes.length - 1];
}

/** 走完整 startPreheat */
function preheated(s: GameState, opts: { goal?: number; days?: number; preheat?: number; ratio?: number; platform?: string } = {}) {
  const p = s.designer.prototypes[s.designer.prototypes.length - 1];
  const r = startPreheat(s, p.uid, opts.platform ?? 'moudian', opts.goal ?? 50, opts.days ?? 30, opts.preheat ?? 5, opts.ratio ?? 1);
  if (!r.ok) throw new Error(`发起失败: ${r.reason}`);
  return s.designer.campaigns[s.designer.campaigns.length - 1];
}

/** 直接构造 live 状态的 campaign（跳过预热，精确控制数值） */
function liveCampaign(s: GameState, opts: Partial<DesignCampaign> = {}): DesignCampaign {
  const score = opts.score ?? 30;
  const c: DesignCampaign = {
    uid: opts.uid ?? s.designer.nextUid++,
    name: opts.name ?? '测试项目', themeId: 'euro', scale: 'standard',
    score, rarity: rarityOf(score),
    costPrice: opts.costPrice ?? 100, price: opts.price ?? 100,
    goal: opts.goal ?? 50, days: opts.days ?? 30, preheatDays: 0,
    platformId: opts.platformId ?? 'moudian', status: 'live',
    watchers: 0, exposure: 0, watchersDays: 0, demandDays: 0, convertRate: 0,
    elapsedSec: 0, supporters: 0, flowMult: 1, eventTimer: 0,
    usedEvents: [], pendingEvents: [], eventHistory: [], milestonesHit: [], boostCount: 0,
    iter: { mech: 0, balance: 0, replay: 0, art: 0, rules: 0, theme: 0 },
    ...opts,
  };
  s.designer.campaigns.push(c);
  return c;
}

const ZERO_ITER = { mech: 0, balance: 0, replay: 0, art: 0, rules: 0, theme: 0 };

describe('设计师：解锁与灵感（v1 保留）', () => {
  it('担任「桌游设计师」职业解锁（周目内永久）；其他职业不解锁', () => {
    const s = defaultState();
    expect(s.designer.unlocked).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'euro', 'standard').ok).toBe(false);
    takeJob(s, 'teacher');
    expect(s.designer.unlocked).toBe(false);
    takeJob(s, 'master');
    expect(s.designer.unlocked).toBe(true);
    takeJob(s, 'teacher');
    expect(s.designer.unlocked).toBe(true);
  });

  it('灵感只看游玩时长：base = max(1, round(playTime/30))；稀有度/隐藏不影响，未解锁不加', () => {
    const s = unlocked(defaultState());
    expect(inspireGain(s, gameById('guoyuan'))).toBe(1); // 15 分钟
    expect(inspireGain(s, gameById('zhitu'))).toBe(2);   // 45 分钟
    expect(inspireGain(s, gameById('toumi'))).toBe(4);   // 120 分钟
    expect(inspireGain(s, gameById('mofa'))).toBe(5);    // 150 分钟
    // 同 playTime 的 N 与 SSR（含隐藏）获得相同灵感
    const kafei = gameById('kafei'); // 30 分钟 N
    expect(inspireGain(s, { ...kafei, rarity: 'SSR', hidden: true })).toBe(inspireGain(s, kafei));
    const s2 = defaultState();
    own(s2, 'guoyuan');
    expect(settleRound(s2, 'guoyuan', uidOf(s2, 'guoyuan'), 1, () => 0.99).inspiration).toBe(0);
  });

  it('单局封顶 5：insp-up 乘区后仍 min(5, ·)', () => {
    const s = unlocked(defaultState());
    s.prestige.shop['insp-up'] = 2; // ×1.3
    expect(inspireGain(s, gameById('toumi'))).toBe(5); // base4×1.3=5.2 → 5
    expect(inspireGain(s, gameById('mofa'))).toBe(5);  // base5×1.3=6.5 → 7 → 封顶 5
    const s2 = unlocked(defaultState());
    expect(inspireGain(s2, gameById('zhitu'))).toBe(2);
    s2.prestige.shop['insp-up'] = 1;
    expect(inspireGain(s2, gameById('zhitu'))).toBe(Math.round(2 * 1.15)); // 2.3 → 2
  });

  it('灵感动态上限：基础 100，精通按稀有度 +1~+4，到达上限截断，转生重置', () => {
    const s = unlocked(defaultState());
    expect(inspireCap(s)).toBe(100);
    own(s, 'guoyuan', { prof: 20 });    // N 精通 +1
    own(s, 'lingji', { prof: 160 });    // SSR 精通 +4
    expect(inspireCap(s)).toBe(105);
    // 截断：104 + 1（果园 15 分钟）→ 105；再玩不加
    s.designer.inspiration = 104;
    own(s, 'zhitu'); // 第二盒，未精通
    expect(settleRound(s, 'zhitu', uidOf(s, 'zhitu'), 1, () => 0.99).inspiration).toBe(1);
    expect(s.designer.inspiration).toBe(105);
    expect(settleRound(s, 'zhitu', uidOf(s, 'zhitu'), 2, () => 0.99).inspiration).toBe(0);
    // 转生重置：精通清空 → 上限回 100
    for (const g of ['zongming', 'kafei', 'zhitu']) own(s, g, { prof: 20 });
    expect(doPrestige(s).ok).toBe(true);
    expect(inspireCap(s)).toBe(100);
  });
});

describe('设计师：立项与经营 activity', () => {
  it('foundPrototype 扣 10 灵感；名称 2~10 字 / 未知类型体量 / 灵感不足拒绝', () => {
    const s = unlocked(defaultState());
    s.designer.inspiration = 100;
    const r = foundPrototype(s, '  星海拾遗  ', 'mystery', 'big');
    expect(r.ok).toBe(true);
    const p = s.designer.prototypes[0];
    expect(p.name).toBe('星海拾遗');
    expect(Object.values(p.iter).every(v => v === 0)).toBe(true);
    expect(p.exposure).toBe(0);
    expect(s.designer.inspiration).toBe(90);
    expect(foundPrototype(s, '短', 'euro', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '这个名字实在太长太长啦', 'euro', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'ghost', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'euro', 'ghost').ok).toBe(false);
    s.designer.inspiration = 0;
    expect(foundPrototype(s, '灵感方舟', 'euro', 'standard').ok).toBe(false);
  });

  it('经营成本递增：试玩 ¥50×2ⁿ、宣传 ¥30×1.6ⁿ（取整）', () => {
    expect(playtestCost(0)).toBe(50);
    expect(playtestCost(1)).toBe(100);
    expect(playtestCost(2)).toBe(200);
    expect(promoCost(0)).toBe(30);
    expect(promoCost(1)).toBe(48);
    expect(promoCost(2)).toBe(77); // 76.8 取整
  });

  it('组织试玩：扣钱、曝光与种子入账（rng=0 最小产出），沉浸/应变每级 +4% 产出', () => {
    const s = unlocked(defaultState());
    const p = found(s);
    s.money = 1000;
    const r = runActivity(s, p.uid, 'playtest', () => 0, 0);
    expect(r.ok).toBe(true);
    expect(s.money).toBe(950);
    expect(p.exposure).toBe(8); // rng0 → +8，种子 +0
    expect(p.seeds).toBe(0);
    // 沉浸 1 级 + 应变 1 级 → 产出 ×1.08：round(8×1.08)=9
    const s2 = unlocked(defaultState());
    s2.attrExp['沉浸'] = expToReach(1);
    s2.attrExp['应变'] = expToReach(1);
    const p2 = found(s2);
    runActivity(s2, p2.uid, 'playtest', () => 0, 0);
    expect(p2.exposure).toBe(9);
  });

  it('每日上限：试玩/宣传各 3 次/游戏日（24 秒），跨日重置；日记由灵感限制', () => {
    const s = unlocked(defaultState());
    const p = found(s);
    s.money = 1e9;
    for (let i = 0; i < ACTIVITY_DAILY_LIMIT; i++) expect(runActivity(s, p.uid, 'playtest', () => 0, 0).ok).toBe(true);
    expect(runActivity(s, p.uid, 'playtest', () => 0, 0).ok).toBe(false); // 第 4 次
    // 同一游戏日内（毫秒戳差 23 秒）仍受限
    expect(runActivity(s, p.uid, 'playtest', () => 0, 23_000).ok).toBe(false);
    // 跨游戏日（+24 秒 = 24000 毫秒）重置
    expect(runActivity(s, p.uid, 'playtest', () => 0, DAY_SECONDS * 1000).ok).toBe(true);
    // 日记：灵感限制（无每日上限）
    s.designer.inspiration = 6;
    expect(runActivity(s, p.uid, 'diary', () => 0, DAY_SECONDS * 1000).ok).toBe(true);
    expect(runActivity(s, p.uid, 'diary', () => 0, DAY_SECONDS * 1000).ok).toBe(true);
    expect(runActivity(s, p.uid, 'diary', () => 0, DAY_SECONDS * 1000).ok).toBe(false); // 灵感耗尽
    expect(p.exposure).toBe(8 * 4 + 4 * 2); // 4 试玩 + 2 日记
  });

  it('曝光软上限 200：超出部分收益减半', () => {
    expect(addExposure(0, 100)).toBe(100);
    expect(addExposure(195, 10)).toBe(200 + 2.5); // 超 5 减半天 2.5
    expect(addExposure(200, 10)).toBe(205);
    expect(EXPOSURE_SOFTCAP).toBe(200);
  });
});

describe('设计师：预热与时间池', () => {
  it('每日看好公式：round((曝光/10 + 平台基础曝光) × 定价亲和 × 质量系数)', () => {
    expect(watcherDailyGain(0, 'moudian', 1, 50)).toBe(Math.round(25 * 1.2 * 1.0)); // 30
    expect(watcherDailyGain(0, 'xinwu', 1, 50)).toBe(Math.round(12 * 1.2 * 1.0)); // 14
    expect(watcherDailyGain(100, 'moudian', 1, 50)).toBe(Math.round(35 * 1.2 * 1.0)); // 42
    expect(watcherDailyGain(0, 'moudian', 10, 50)).toBe(Math.round(25 * 0.6 * 1.0)); // 15（亲和线性）
    expect(watcherDailyGain(0, 'moudian', 1, 100)).toBe(Math.round(25 * 1.2 * 1.2)); // 36
  });

  it('转化率边界：Q100 定价100% → 25%；定价1000% → 7%；低质高价触下限 5%', () => {
    expect(convertRate(100, 1)).toBeCloseTo(0.25, 10);
    expect(convertRate(100, 10)).toBeCloseTo(0.07, 10);
    expect(convertRate(0, 10)).toBe(0.05);
    expect(convertRate(50, 1)).toBeCloseTo(0.20, 10);
    expect(preheatMax(60)).toBe(30);
    expect(preheatMax(40)).toBe(25);
    expect(PREHEAT_MIN).toBe(5);
  });

  it('时间池校验：T∈[30,120]、P∈[5, min(30,T−15)]、平台/目标合法', () => {
    const s = unlocked(defaultState());
    found(s);
    const uid = s.designer.prototypes[0].uid;
    expect(startPreheat(s, uid, 'moudian', 50, 29, 5, 1).ok).toBe(false); // T 太短
    expect(startPreheat(s, uid, 'moudian', 50, 121, 5, 1).ok).toBe(false);
    expect(startPreheat(s, uid, 'moudian', 50, 60, 4, 1).ok).toBe(false); // P<5
    expect(startPreheat(s, uid, 'moudian', 50, 60, 31, 1).ok).toBe(false); // P>30
    expect(startPreheat(s, uid, 'moudian', 50, 40, 26, 1).ok).toBe(false); // P>min(30,25)
    expect(startPreheat(s, uid, 'ghost', 50, 60, 10, 1).ok).toBe(false); // 未知平台
    expect(startPreheat(s, uid, 'moudian', 49, 60, 10, 1).ok).toBe(false); // 目标越界
    expect(startPreheat(s, uid, 'moudian', 50, 60, 10, 0.5).ok).toBe(false); // 定价越界
    expect(startPreheat(s, uid, 'moudian', 50, 40, 25, 1).ok).toBe(true); // P=25 恰好
  });

  it('预热逐日攒看好、开众筹瞬间 × 转化率转初始支持，状态机 preheat → live', () => {
    const s = unlocked(defaultState());
    const p = found(s, '预热船', 'euro', 'standard');
    p.seeds = 7;
    const c = preheated(s, { goal: 50, days: 30, preheat: 5, ratio: 1 }); // Q30 → 亲和 1.2、质量 0.92
    expect(c.status).toBe('preheat');
    expect(c.watchers).toBe(7); // 种子转入
    const perDay = watcherDailyGain(0, 'moudian', 1, 30); // round(25×1.2×0.92)=28
    tickCrowd(s, () => 0.999, 5 * DAY_SECONDS - 1);
    expect(c.status).toBe('preheat');
    expect(c.watchers).toBe(7 + 4 * perDay); // 4 整天
    tickCrowd(s, () => 0.999, 1);
    expect(c.status).toBe('live');
    expect(c.watchers).toBe(7 + 5 * perDay);
    expect(c.convertRate).toBeCloseTo(convertRate(30, 1), 10);
    expect(c.supporters).toBe(Math.floor(c.watchers * c.convertRate));
  });

  it('预热期追加宣传：扣钱加曝光，按剩余天数折算看好', () => {
    const s = unlocked(defaultState());
    found(s, '宣传船', 'euro', 'standard');
    const c = preheated(s, { days: 30, preheat: 5 });
    s.money = 1000;
    const before = c.watchers;
    const r = boostCampaign(s, c.uid, () => 0); // 花费 30，曝光 +5
    expect(r.ok).toBe(true);
    expect(s.money).toBe(970);
    expect(c.exposure).toBe(5);
    const remaining = c.preheatDays - c.watchersDays; // 5
    const delta = Math.round((5 / 10) * 1.2 * 0.92 * remaining); // 3
    expect(c.watchers).toBe(before + delta);
    expect(boostCampaign(s, c.uid, () => 0).ok).toBe(true); // 成本递增第二档 48
    expect(s.money).toBe(970 - 48);
  });

  it('预热期不可迭代；追加宣传仅限预热期', () => {
    const s = unlocked(defaultState());
    found(s);
    const c = preheated(s);
    expect(iterateProto(s, c.uid, 'mech').ok).toBe(false); // 已不在原型列表
    tickCrowd(s, () => 0.999, c.preheatDays * DAY_SECONDS); // 进入 live
    expect(boostCampaign(s, c.uid, () => 0).ok).toBe(false);
  });
});

describe('设计师：众筹期与平台结算（两阶段 + 抽成）', () => {
  it('需求按游戏日结算（v5.1）：23 秒 0 次、第 24 秒一次判定，k×10 人数上界', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '必买船' }); // ratio 1 → p=0.4
    tickCrowd(s, () => 0, 23);
    expect(c.supporters).toBe(0); // 不足一整天不结算
    tickCrowd(s, () => 0, 1);     // 第 24 秒：k=1 → 10 人判定
    expect(c.demandDays).toBe(1);
    expect(c.supporters).toBe(10); // rng 0 全买（10 人 × p>0）
    // 批量跨天：一次推 48 秒 = 2 天
    tickCrowd(s, () => 0, 48);
    expect(c.demandDays).toBe(3);
    expect(c.supporters).toBe(10 + 20); // 每天 k=1（支持<100）× 10 人
    // k×10 上界：支持 ≥900 时 k=10 → 单日至多 100 人（调高目标避开里程碑加成）
    c.supporters = 900;
    c.goal = 1000;
    tickCrowd(s, () => 0, 24);
    expect(c.supporters - 900).toBeLessThanOrEqual(100);
    const s2 = unlocked(defaultState());
    const c2 = liveCampaign(s2, { name: '滞销书', price: 1000, costPrice: 100, goal: 50 }); // ratio 10 → p=0
    tickCrowd(s2, () => 0.999, 24);
    expect(c2.supporters).toBe(0);
  });

  it('平台抽成结算：到期到账 firstPayment=round((货款−抽成)×50%)；某点 5% vs 某集 3%', () => {
    // 某点
    const s = unlocked(defaultState());
    s.money = 0;
    liveCampaign(s, { name: '某点船', price: 100, costPrice: 100, goal: 50, days: 30 });
    const events = tickCrowd(s, () => 0, 30 * DAY_SECONDS);
    expect(events).toHaveLength(1);
    const f = s.designer.funded[0];
    expect(f.supporters).toBeGreaterThanOrEqual(30 * DAY_SECONDS); // 支持/100 加速 + 里程碑加成
    expect(f.income).toBe(f.supporters * 100);
    expect(f.commission).toBe(Math.round(f.income * 0.05));
    expect(f.firstPayment).toBe(Math.round((f.income - f.commission) * 0.5));
    expect(f.remainPayment).toBe(f.income - f.commission - f.firstPayment);
    expect(s.money).toBe(f.firstPayment); // 立即到账一半
    expect(s.designer.successCount).toBe(1);
    // 某集：同条件仅平台不同
    const s2 = unlocked(defaultState());
    s2.money = 0;
    liveCampaign(s2, { name: '某集船', price: 100, costPrice: 100, goal: 50, days: 30, platformId: 'xinwu' });
    tickCrowd(s2, () => 0, 30 * DAY_SECONDS);
    const f2 = s2.designer.funded[0];
    expect(f2.commission).toBe(Math.round(f2.income * 0.03));
    expect(f2.commission).toBeLessThan(f.commission);
    expect(platformById('moudian').baseExposure).toBe(25);
    expect(platformById('xinwu').baseExposure).toBe(12);
  });

  it('deliverDesign v5：垫资成本 + 收尾款 remainPayment，净额 = 货款−抽成−成本（可为负）', () => {
    const s = unlocked(defaultState());
    s.money = 1000000;
    liveCampaign(s, { name: '交付船', price: 100, costPrice: 100, goal: 50, days: 30 });
    tickCrowd(s, () => 0, 30 * DAY_SECONDS);
    const f = s.designer.funded[0];
    expect(s.money).toBe(1000000 + f.firstPayment);
    const r = deliverDesign(s, f.uid);
    expect(r.ok).toBe(true);
    expect(s.money).toBe(1000000 + f.firstPayment - f.cost + f.remainPayment);
    expect(f.delivered).toBe(true);
    expect(f.income - f.commission - f.cost).toBe(-f.commission); // 售价=成本价 → 净亏抽成
    expect(deliverDesign(s, f.uid).ok).toBe(false); // 重复拒绝
    const s2 = unlocked(defaultState());
    s2.designer.funded.push({ uid: 1, name: '亏损船', score: 60, rarity: 'R', price: 30, supporters: 100, cost: 4200, income: 3000, commission: 90, firstPayment: 1455, remainPayment: 1455, delivered: false });
    s2.money = 4199;
    const r2 = deliverDesign(s2, 1);
    expect(r2.ok).toBe(false); // 垫资不足
    expect(!r2.ok && r2.reason).toContain('资金不足');
    expect(s2.designer.funded[0].delivered).toBe(false);
  });

  it('到期失败：无资金往来、原型退回、进 failed', () => {
    const s = unlocked(defaultState());
    s.money = 500;
    liveCampaign(s, { name: '生不逢时', price: 1000, costPrice: 100, goal: 1000, days: 30 });
    const events = tickCrowd(s, () => 0.999, 30 * DAY_SECONDS);
    expect(events[0]).toMatchObject({ name: '生不逢时', ok: false, supporters: 0 });
    expect(s.money).toBe(500);
    expect(s.designer.failed).toHaveLength(1);
    expect(s.designer.prototypes).toHaveLength(1); // 原型退回
    expect(s.designer.prototypes[0].iter).toEqual(ZERO_ITER);
  });

  it('里程碑解锁：150%/200% 目标自动 +3%/+5% 并记入历史', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '爆款船', price: 100, costPrice: 100, goal: 50, days: 40 });
    tickCrowd(s, () => 0, 40 * DAY_SECONDS);
    expect(c.milestonesHit).toContain(150);
    expect(c.milestonesHit).toContain(200);
    const milestones = c.eventHistory.filter(h => h.kind === 'milestone');
    expect(milestones.length).toBe(2);
    expect(milestones[0].result).toContain('解锁回报');
    // 每日结算 k×10 人 + 支持/100 加速 + 里程碑加成，35 个众筹日远超原逐秒阈值
    expect(c.supporters).toBeGreaterThan(40 * DAY_SECONDS);
  });

  it('离线复用同一逐秒函数（accumulateOffline 推进众筹 + 事件照常生成）', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '挂机船', price: 100, costPrice: 100, goal: 1000, days: 30 });
    accumulateOffline(s, 60 * 1000, () => 0.999);
    expect(c.elapsedSec).toBe(60);
    expect(s.designer.campaigns).toHaveLength(1);
  });
});

describe('设计师：事件系统', () => {
  it('触发：每 5 天 60% 判定；rng 0 必触发、0.999 不触发；不重复直到轮空', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '事件船', price: 1000, costPrice: 100 }); // p=0 不涨支持
    tickCrowd(s, () => 0, 5 * DAY_SECONDS);
    expect(c.pendingEvents).toHaveLength(1);
    expect(c.usedEvents).toEqual([c.pendingEvents[0].eventId]);
    expect(c.pendingEvents[0].remainingSec).toBe(5 * DAY_SECONDS);
    const s2 = unlocked(defaultState());
    const c2 = liveCampaign(s2, { name: '平静船', price: 1000, costPrice: 100 });
    tickCrowd(s2, () => 0.999, 5 * DAY_SECONDS);
    expect(c2.pendingEvents).toHaveLength(0);
    // 不重复：连续两个窗口各触发一个，id 不同
    tickCrowd(s, () => 0, 5 * DAY_SECONDS); // 第一个超时自动结算 + 第二个生成
    tickCrowd(s, () => 0, 5 * DAY_SECONDS); // 第二个超时 + 第三个生成
    expect(new Set(c.usedEvents).size).toBe(c.usedEvents.length);
    expect(c.usedEvents.length).toBe(3);
  });

  it('窗口超时按默认选项自动结算（byDefault 记入历史，不耗资源）', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '超时船', price: 1000, costPrice: 100, goal: 1000 });
    s.money = 1000;
    tickCrowd(s, () => 0, 5 * DAY_SECONDS); // 生成 e1（rng0 抽第一个）
    expect(c.pendingEvents[0].eventId).toBe('e1');
    tickCrowd(s, () => 0, 5 * DAY_SECONDS - 1); // 倒计时剩 1
    expect(c.pendingEvents).toHaveLength(1);
    tickCrowd(s, () => 0, 1); // 超时（同一秒事件判定生成下一个，不影响本次结算）
    expect(c.pendingEvents).toHaveLength(1);
    expect(c.pendingEvents[0].eventId).toBe('e2');
    expect(c.eventHistory).toHaveLength(1);
    expect(c.eventHistory[0].byDefault).toBe(true);
    expect(c.eventHistory[0].eventId).toBe('e1');
    expect(s.money).toBe(1000); // 默认不耗资源
  });

  it('进入最后 5 天：所有待决事件按默认自动结算', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '冲刺船', price: 1000, costPrice: 100, goal: 1000, days: 30 });
    c.pendingEvents.push({ eventId: 'e4', remainingSec: 5 * DAY_SECONDS });
    c.pendingEvents.push({ eventId: 'e5', remainingSec: 3 * DAY_SECONDS });
    tickCrowd(s, () => 0.999, 25 * DAY_SECONDS); // 跨入最后 5 天
    expect(c.pendingEvents).toHaveLength(0);
    expect(c.eventHistory.length).toBe(2);
    expect(c.eventHistory.every(h => h.byDefault)).toBe(true);
    expect(c.supporters).toBe(0); // p=0 无增长，e4/e5 默认 −8%/−7% 不扣到负
  });

  it('主动抉择：需求校验（成交额/属性/灵感）+ 结果应用 + 历史记录', () => {
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '抉择船', price: 100, costPrice: 100, supporters: 100, goal: 1000 });
    s.money = 1000;
    s.designer.inspiration = 100;
    c.pendingEvents.push({ eventId: 'e1', remainingSec: 5 * DAY_SECONDS });
    // 选项① 付费推广（成交额 3% = 300）→ +8%
    const r = resolveEvent(s, c.uid, 0, 0, () => 0.5);
    expect(r.ok).toBe(true);
    expect(s.money).toBe(700);
    expect(c.supporters).toBe(108);
    expect(c.eventHistory[0].byDefault).toBe(false);
    // 属性门槛：e8 选项① 沉浸≥10
    c.pendingEvents.push({ eventId: 'e8', remainingSec: 5 * DAY_SECONDS });
    expect(resolveEvent(s, c.uid, 0, 0, () => 0.5).ok).toBe(false); // 沉浸 0 级
    s.attrExp['沉浸'] = expToReach(10);
    expect(resolveEvent(s, c.uid, 0, 0, () => 0.5).ok).toBe(true);
    expect(c.supporters).toBe(Math.round(108 * 1.06)); // +6%
    // 灵感需求：e11 选项① 灵感 5
    s.designer.inspiration = 4;
    c.pendingEvents.push({ eventId: 'e11', remainingSec: 5 * DAY_SECONDS });
    expect(resolveEvent(s, c.uid, 0, 0, () => 0.5).ok).toBe(false);
    s.designer.inspiration = 5;
    expect(resolveEvent(s, c.uid, 0, 0, () => 0.5).ok).toBe(true);
    expect(s.designer.inspiration).toBe(0);
    expect(c.pendingEvents).toHaveLength(0);
    expect(c.eventHistory).toHaveLength(3);
  });

  it('事件池 16 个齐全且每个都有默认选项；流量结果生效（e15 默认 +25%）', () => {
    expect(eventById('e1').name).toContain('KOL');
    for (let i = 1; i <= 16; i++) {
      const def = eventById(`e${i}`);
      expect(def.options.some(o => o.isDefault), def.id).toBe(true);
    }
    const s = unlocked(defaultState());
    const c = liveCampaign(s, { name: '黑马船', price: 1000, costPrice: 100, goal: 1000 });
    c.pendingEvents.push({ eventId: 'e15', remainingSec: 5 * DAY_SECONDS });
    expect(resolveEvent(s, c.uid, 0, 0, () => 0.5).ok).toBe(true);
    expect(c.flowMult).toBeCloseTo(1.25, 10);
    expect(c.supporters).toBe(0); // 0 支持的 +5% 仍为 0
    expect(c.eventHistory[0].result).toContain('流量+25%');
  });
});

describe('设计师：成就与转生', () => {
  it('成就：灵光一现 / 一呼百应 / 万众瞩目（≥800）/ 未发售先火（预热看好 ≥500）', () => {
    const s = unlocked(defaultState());
    found(s);
    expect(checkAchievements(s).map(a => a.id)).toContain('first-proto');
    // 未发售先火：构造高看好预热项目
    s.designer.campaigns.push({ ...liveCampaign(s, { name: '预热王' }), watchers: 500, status: 'preheat' });
    expect(checkAchievements(s).map(a => a.id)).toContain('hot-500');
    // 众筹成功 → 一呼百应
    const c = liveCampaign(s, { name: '爆款', price: 100, costPrice: 100, goal: 50, days: 40 });
    tickCrowd(s, () => 0, 40 * DAY_SECONDS);
    expect(c.supporters).toBeGreaterThanOrEqual(800);
    const ids = checkAchievements(s).map(a => a.id);
    expect(ids).toContain('first-funded');
    expect(ids).toContain('crowd-800');
  });

  it('转生重置设计师状态（不进白名单）', () => {
    const s = unlocked(defaultState());
    for (const g of ['guoyuan', 'zongming', 'kafei', 'zhitu']) own(s, g, { prof: 20 });
    found(s);
    preheated(s);
    expect(doPrestige(s).ok).toBe(true);
    expect(s.designer).toEqual({
      unlocked: false, inspiration: 0, prototypes: [], campaigns: [], funded: [], failed: [], nextUid: 1, successCount: 0,
    });
  });
});

describe('设计师：存档迁移（v15 → v16）', () => {
  it('v15 旧档 normalize：campaign 补 platformId=某点/status=live/watchers=0，funded 补抽成字段且保持旧全额交付', () => {
    const s = defaultState();
    const dirty = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    dirty.saveVersion = 15;
    dirty.designer = {
      unlocked: true,
      inspiration: 42,
      prototypes: [],
      // v15 形态 campaign：无 platformId/status/watchers/preheatDays
      campaigns: [
        { uid: 1, name: '旧项目', themeId: 'euro', scale: 'standard', score: 50, rarity: 'R', costPrice: 400, price: 400, goal: 50, days: 30, elapsedSec: 120, supporters: 10, iter: ZERO_ITER },
      ],
      // v15 形态 funded：无 commission/firstPayment/remainPayment
      funded: [
        { uid: 2, name: '旧成功', score: 60, rarity: 'R', price: 420, supporters: 100, cost: 4200, income: 42000, delivered: false },
      ],
      nextUid: 3, successCount: 1,
    };
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    expect(m!.saveVersion).toBe(SAVE_VERSION);
    const c = m!.designer.campaigns[0];
    expect(c.platformId).toBe('moudian');
    expect(c.status).toBe('live');
    expect(c.watchers).toBe(0);
    expect(c.exposure).toBe(0);
    expect(c.pendingEvents).toEqual([]);
    expect(c.elapsedSec).toBe(120); // 保持
    const f = m!.designer.funded[0];
    expect(f.commission).toBe(0);
    expect(f.firstPayment).toBe(0);
    expect(f.remainPayment).toBe(42000); // 旧数据保持全额交付行为
    expect(f.delivered).toBe(false);
    expect(m!.designer.successCount).toBe(1);
  });

  it('v1 旧字段仍兼容（prototype invested/insp → iter 全 0；published → 并入 funded）', () => {
    const s = defaultState();
    const dirty = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    dirty.saveVersion = 15;
    dirty.designer = {
      unlocked: true,
      prototypes: [{ uid: 1, themeId: 'euro', invested: { 演算: 100 }, insp: 3 }],
      published: [{ uid: 3, name: '旧出版作', themeId: 'euro', score: 80, price: 1000, printedAt: 0, royalties: 50 }],
      nextUid: 1,
    };
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    const d = m!.designer;
    expect(d.prototypes[0].iter).toEqual(ZERO_ITER);
    expect(d.prototypes[0].exposure).toBe(0);
    expect(d.funded[0]).toMatchObject({ uid: 3, score: 80, rarity: 'SR', delivered: true, remainPayment: 0 });
    expect(d.nextUid).toBeGreaterThanOrEqual(4);
  });

  it('旧档高灵感库存按动态上限截断（4 款精通 N = 上限 104）', () => {
    const s = defaultState();
    const dirty = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    dirty.saveVersion = 15;
    dirty.designer = { unlocked: true, inspiration: 800, nextUid: 1 };
    dirty.collections = {
      guoyuan: { firstOpened: true, prof: 20, fatigue: 0, rulesRead: false },
      zongming: { firstOpened: true, prof: 20, fatigue: 0, rulesRead: false },
      kafei: { firstOpened: true, prof: 20, fatigue: 0, rulesRead: false },
      zhitu: { firstOpened: true, prof: 20, fatigue: 0, rulesRead: false },
    };
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    expect(m!.designer.inspiration).toBe(104); // 100 + 4×N(1)
  });
});

// 既有公式锚点（v4 保留）：需求概率分解
describe('设计师：需求概率分解（v4 保留）', () => {
  it('题材/低价/溢价线性/稀有度/畅销作家逐项', () => {
    const s = unlocked(defaultState());
    const base = { themeId: 'euro', price: 400, costPrice: 400, rarity: 'N' as const };
    expect(demandParts(s, base, 'euro', 'solo').theme).toBe(0.1);
    expect(demandParts(s, base, 'euro', 'euro').theme).toBe(0.2);
    expect(demandParts(s, { ...base, price: 199 }, 'solo', 'party').cheap).toBe(0.1);
    expect(demandParts(s, { ...base, price: 2200 }, 'solo', 'party').margin).toBeCloseTo(0.15, 10);
    expect(demandParts(s, { ...base, rarity: 'SSR' }, 'solo', 'party').rarity).toBe(0.2);
    s.prestige.shop['royalty-up'] = 2;
    expect(demandParts(s, base, 'solo', 'party').perk).toBeCloseTo(0.12, 10);
  });
});
