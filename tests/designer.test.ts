import { describe, expect, it } from 'vitest';
import {
  CROWD_SUCCESS_LIMIT, DAY_SECONDS, DESIGN_DIMS, ITER_MAX, SAVE_VERSION,
  accumulateOffline, applySleeve, attrLevel, checkAchievements, defaultState,
  demandParts, deliverDesign, doPrestige, foundPrototype, iterateProto,
  launchCrowd, parseSave, qualityOf, rarityOf, costPriceOf, settleRound,
  takeJob, tickCrowd,
} from '../src/core';
import type { GameState } from '../src/core';
import { expToReach, own, uidOf } from './helpers';

/** 解锁设计师（担任 master 职业） */
function unlocked(s: GameState): GameState {
  takeJob(s, 'master');
  return s;
}

/** 解锁 + 满灵感 + 立项一个原型 */
function found(s: GameState, name = '灵感方舟', themeId = 'euro', scale = 'standard') {
  s.designer.inspiration = 999;
  const r = foundPrototype(s, name, themeId, scale);
  if (!r.ok) throw new Error(`立项失败: ${r.reason}`);
  return s.designer.prototypes[s.designer.prototypes.length - 1];
}

/** 发起众筹（默认目标 50 / 30 天 / 定价 100%） */
function launched(s: GameState, opts: { goal?: number; days?: number; ratio?: number } = {}) {
  const p = s.designer.prototypes[s.designer.prototypes.length - 1];
  const r = launchCrowd(s, p.uid, opts.goal ?? 50, opts.days ?? 30, opts.ratio ?? 1);
  if (!r.ok) throw new Error(`发起失败: ${r.reason}`);
  return s.designer.campaigns[s.designer.campaigns.length - 1];
}

describe('设计师：解锁与灵感（v1 保留）', () => {
  it('担任「桌游设计师」职业解锁（周目内永久）；其他职业不解锁', () => {
    const s = defaultState();
    expect(s.designer.unlocked).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'euro', 'standard').ok).toBe(false); // 未解锁
    takeJob(s, 'teacher');
    expect(s.designer.unlocked).toBe(false);
    takeJob(s, 'master');
    expect(s.designer.unlocked).toBe(true);
    takeJob(s, 'teacher');
    expect(s.designer.unlocked).toBe(true); // 换工作不回退
  });

  it('settleRound 按稀有度入账灵感（N1/R2/SR4/SSR8，隐藏款 ×2），未解锁不加', () => {
    const s = unlocked(defaultState());
    own(s, 'guoyuan'); // N
    own(s, 'yueliang'); // R
    own(s, 'tigemei'); // SR
    own(s, 'lingji'); // SSR
    own(s, 'hezou'); // N 隐藏款
    expect(settleRound(s, 'guoyuan', uidOf(s, 'guoyuan'), 1, () => 0.99).inspiration).toBe(1);
    expect(settleRound(s, 'yueliang', uidOf(s, 'yueliang'), 1, () => 0.99).inspiration).toBe(2);
    expect(settleRound(s, 'tigemei', uidOf(s, 'tigemei'), 1, () => 0.99).inspiration).toBe(4);
    expect(settleRound(s, 'lingji', uidOf(s, 'lingji'), 1, () => 0.99).inspiration).toBe(8);
    expect(settleRound(s, 'hezou', uidOf(s, 'hezou'), 1, () => 0.99).inspiration).toBe(2); // 隐藏 ×2
    const s2 = defaultState();
    own(s2, 'guoyuan');
    expect(settleRound(s2, 'guoyuan', uidOf(s2, 'guoyuan'), 1, () => 0.99).inspiration).toBe(0);
  });

  it('insp-up 乘区 +15%/级，且灵感 cap 999', () => {
    const s = unlocked(defaultState());
    s.prestige.shop['insp-up'] = 2; // ×1.3
    own(s, 'guoyuan');
    expect(settleRound(s, 'guoyuan', uidOf(s, 'guoyuan'), 1, () => 0.99).inspiration).toBeCloseTo(1.3, 10);
    // cap：直接顶到 998 再加 SSR 8×1.3 → 封顶 999
    s.designer.inspiration = 998;
    own(s, 'aoding');
    const gained = settleRound(s, 'aoding', uidOf(s, 'aoding'), 1, () => 0.99).inspiration;
    expect(gained).toBeCloseTo(999 - 998, 10);
    expect(s.designer.inspiration).toBe(999);
  });
});

describe('设计师：立项', () => {
  it('foundPrototype 扣 10 灵感，记录名称/类型/体量，iter 全 0', () => {
    const s = unlocked(defaultState());
    s.designer.inspiration = 100;
    const r = foundPrototype(s, '  星海拾遗  ', 'mystery', 'big');
    expect(r.ok).toBe(true);
    const p = s.designer.prototypes[0];
    expect(p.name).toBe('星海拾遗'); // trim
    expect(p.themeId).toBe('mystery');
    expect(p.scale).toBe('big');
    expect(Object.values(p.iter).every(v => v === 0)).toBe(true);
    expect(s.designer.inspiration).toBe(90);
    expect(s.designer.nextUid).toBe(2);
  });

  it('名称校验：1 字 / 11 字 / 未知类型 / 未知体量 / 灵感不足均拒绝', () => {
    const s = unlocked(defaultState());
    s.designer.inspiration = 10;
    expect(foundPrototype(s, '短', 'euro', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '这个名字实在太长太长啦', 'euro', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'ghost', 'standard').ok).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'euro', 'ghost').ok).toBe(false);
    expect(foundPrototype(s, '灵感方舟', 'euro', 'standard').ok).toBe(true); // 恰好 10 灵感
    expect(foundPrototype(s, '第二艘船', 'euro', 'standard').ok).toBe(false); // 灵感已用完
    expect(s.designer.prototypes).toHaveLength(1);
  });
});

describe('设计师：六维迭代', () => {
  it('维度与属性一一对应表', () => {
    expect(DESIGN_DIMS.map(d => [d.key, d.attr])).toEqual([
      ['mech', '谋略'], ['balance', '演算'], ['replay', '应变'],
      ['art', '洞察'], ['rules', '运筹'], ['theme', '沉浸'],
    ]);
    expect(DESIGN_DIMS).toHaveLength(6);
  });

  it('iterateProto 扣递增灵感（5/10/15…），维度上限 5，属性经验全程不动', () => {
    const s = unlocked(defaultState());
    s.attrExp['谋略'] = 12345; // 属性经验任意值，迭代不得触碰
    s.attrExp['演算'] = expToReach(5); // 演算 5 级
    const p = found(s);
    const expBefore = { ...s.attrExp };
    expect(iterateProto(s, p.uid, 'mech').ok).toBe(true); // -5
    expect(iterateProto(s, p.uid, 'mech').ok).toBe(true); // -10
    expect(iterateProto(s, p.uid, 'mech').ok).toBe(true); // -15
    expect(s.designer.inspiration).toBe(999 - 10 - 30); // 立项 -10 + 迭代 30
    expect(p.iter.mech).toBe(3);
    iterateProto(s, p.uid, 'mech'); // -20 → 4
    iterateProto(s, p.uid, 'mech'); // -25 → 5
    expect(p.iter.mech).toBe(ITER_MAX);
    expect(iterateProto(s, p.uid, 'mech').ok).toBe(false); // 已满
    expect(s.attrExp).toEqual(expBefore); // 属性永不消耗
    expect(attrLevel(s, '演算')).toBe(5); // 等级不受影响
  });

  it('增益公式钉死：Lv5 非主场 +4、主场 +5（Q 差值）', () => {
    const s = unlocked(defaultState());
    s.attrExp['演算'] = expToReach(5); // 演算 5 级
    // 德式精算（主属性 演算）→ 主场维度 balance
    const p = found(s, '试作一号', 'euro', 'standard');
    const q0 = qualityOf(s, p);
    iterateProto(s, p.uid, 'balance'); // 主场：2+floor(2)+1 = 5
    expect(qualityOf(s, p) - q0).toBe(5);
    const p2 = found(s, '试作二号', 'euro', 'standard');
    const q2 = qualityOf(s, p2);
    iterateProto(s, p2.uid, 'mech'); // 非主场（谋略 0 级）：2+0 = 2
    expect(qualityOf(s, p2) - q2).toBe(2);
    // 谋略 5 级后非主场 = 2+2 = 4
    s.attrExp['谋略'] = expToReach(5);
    const p3 = found(s, '试作三号', 'euro', 'standard');
    const q3 = qualityOf(s, p3);
    iterateProto(s, p3.uid, 'mech');
    expect(qualityOf(s, p3) - q3).toBe(4);
  });

  it('灵感不够迭代拒绝；score-up 乘区作用于 Q', () => {
    const s = unlocked(defaultState());
    const p = found(s);
    s.designer.inspiration = 4;
    expect(iterateProto(s, p.uid, 'mech').ok).toBe(false);
    expect(p.iter.mech).toBe(0);
    // score-up 2 级：Q = round(基础 × 1.16)
    const s2 = unlocked(defaultState());
    s2.prestige.shop['insp-up'] = 1;
    s2.prestige.shop['score-up'] = 2;
    const p2 = found(s2);
    iterateProto(s2, p2.uid, 'mech'); // 谋略 0 级非主场 +2
    expect(qualityOf(s2, p2)).toBe(Math.round(32 * 1.16)); // 33
  });
});

describe('设计师：Q / 稀有度 / 成本价', () => {
  it('稀有度阈值：49→N / 50→R / 69→R / 70→SR / 89→SR / 90→SSR', () => {
    expect(rarityOf(49)).toBe('N');
    expect(rarityOf(50)).toBe('R');
    expect(rarityOf(69)).toBe('R');
    expect(rarityOf(70)).toBe('SR');
    expect(rarityOf(89)).toBe('SR');
    expect(rarityOf(90)).toBe('SSR');
  });

  it('成本价 = round(体量基数 × (0.8+Q/100))；Q=60 标准 → 420', () => {
    expect(costPriceOf(60, 'standard')).toBe(Math.round(300 * 1.4)); // 420
    expect(costPriceOf(60, 'small')).toBe(Math.round(120 * 1.4)); // 168
    expect(costPriceOf(60, 'big')).toBe(Math.round(600 * 1.4)); // 840
  });
});

describe('设计师：需求概率（demandParts 逐项）', () => {
  it('题材匹配 +10%（单/双）、价格<200 +10%、溢价线性、稀有度、畅销作家', () => {
    const s = unlocked(defaultState());
    const base = { themeId: 'euro', price: 400, costPrice: 400, rarity: 'N' as const };
    // 无命中：margin ratio=1 → 0.3，其余 0
    expect(demandParts(s, base, 'solo', 'party')).toMatchObject({ theme: 0, cheap: 0, rarity: 0, perk: 0 });
    expect(demandParts(s, base, 'euro', 'solo').theme).toBe(0.1); // 单题材命中
    expect(demandParts(s, base, 'euro', 'euro').theme).toBe(0.2); // 双命中
    expect(demandParts(s, { ...base, price: 199 }, 'solo', 'party').cheap).toBe(0.1);
    expect(demandParts(s, { ...base, price: 200 }, 'solo', 'party').cheap).toBe(0);
    // 溢价线性：100%→+30%，1000%→+0%，中间线性（550%→+15%）
    expect(demandParts(s, { ...base, price: 400 }, 'solo', 'party').margin).toBeCloseTo(0.3, 10);
    expect(demandParts(s, { ...base, price: 4000 }, 'solo', 'party').margin).toBeCloseTo(0, 10);
    expect(demandParts(s, { ...base, price: 2200 }, 'solo', 'party').margin).toBeCloseTo(0.15, 10);
    // 稀有度 0/5/10/20%
    expect(demandParts(s, { ...base, rarity: 'N' }, 'solo', 'party').rarity).toBe(0);
    expect(demandParts(s, { ...base, rarity: 'R' }, 'solo', 'party').rarity).toBe(0.05);
    expect(demandParts(s, { ...base, rarity: 'SR' }, 'solo', 'party').rarity).toBe(0.1);
    expect(demandParts(s, { ...base, rarity: 'SSR' }, 'solo', 'party').rarity).toBe(0.2);
    // 畅销作家（royaltyUp）每级 +6%
    expect(demandParts(s, base, 'solo', 'party').perk).toBe(0);
    s.prestige.shop['insp-up'] = 1;
    s.prestige.shop['score-up'] = 1;
    s.prestige.shop['royalty-up'] = 2;
    expect(demandParts(s, base, 'solo', 'party').perk).toBeCloseTo(0.12, 10);
    // 合计 = 各项之和（0.2+0.1+0.3+0.2+0.12 = 0.92）
    const maxed = { themeId: 'euro', price: 1, costPrice: 1, rarity: 'SSR' as const };
    expect(demandParts(s, maxed, 'euro', 'euro').total).toBeCloseTo(0.92, 10);
  });
});

describe('设计师：众筹', () => {
  it('launchCrowd 锁 Q/稀有度/成本价/售价，原型转入进行中（不可再迭代）', () => {
    const s = unlocked(defaultState());
    const p = found(s, '灵感方舟', 'euro', 'standard');
    iterateProto(s, p.uid, 'mech'); // Q 30→32
    const c = launched(s, { goal: 100, days: 45, ratio: 2 });
    expect(c.score).toBe(32);
    expect(c.rarity).toBe('N');
    expect(c.costPrice).toBe(costPriceOf(32, 'standard'));
    expect(c.price).toBe(Math.round(c.costPrice * 2));
    expect(c.goal).toBe(100);
    expect(c.days).toBe(45);
    expect(s.designer.prototypes).toHaveLength(0);
    expect(iterateProto(s, c.uid, 'mech').ok).toBe(false); // 已锁定
  });

  it('参数越界拒绝：goal/days/ratio；成功满 10 款拒绝再发起', () => {
    const s = unlocked(defaultState());
    found(s);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 49, 30, 1).ok).toBe(false);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 1001, 30, 1).ok).toBe(false);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 50, 29, 1).ok).toBe(false);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 50, 121, 1).ok).toBe(false);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 50, 30, 0.5).ok).toBe(false);
    expect(launchCrowd(s, s.designer.prototypes[0].uid, 50, 30, 10.5).ok).toBe(false);
    expect(launchCrowd(s, 999, 50, 30, 1).ok).toBe(false); // 原型不存在
    expect(s.designer.campaigns).toHaveLength(0);
    // 满 10 款
    const s2 = unlocked(defaultState());
    s2.designer.successCount = CROWD_SUCCESS_LIMIT;
    found(s2);
    const r = launchCrowd(s2, s2.designer.prototypes[0].uid, 50, 30, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('后续版本');
  });

  it('逐秒模拟确定性：p=1 必买（rng 0 全命中题材）、p=0 不买（高价无加成）', () => {
    // 必买：rng 0 → k=1、题材双中 euro、roll 0 < p
    const s = unlocked(defaultState());
    found(s, '必买船', 'euro', 'standard');
    const c = launched(s, { ratio: 1 }); // margin +30%，题材 +20% → p=0.5+
    tickCrowd(s, () => 0, 3);
    expect(c.supporters).toBe(3); // 每秒 1 人
    // 不买：大盒 ratio 10（margin 0）、售价≥200、稀有度 N、题材 solo（rng 0.999 → THEMES[7]）
    const s2 = unlocked(defaultState());
    found(s2, '滞销书', 'euro', 'big');
    const c2 = launched(s2, { ratio: 10 });
    tickCrowd(s2, () => 0.999, 5);
    expect(c2.supporters).toBe(0);
  });

  it('到期成功：钱不动、待交付（cost/income 正确），提前满额继续累积', () => {
    const s = unlocked(defaultState());
    s.money = 0;
    found(s, '爆款预定', 'euro', 'standard');
    const c = launched(s, { goal: 50, days: 30, ratio: 1 }); // 720 秒
    tickCrowd(s, () => 0, 30 * DAY_SECONDS - 1);
    expect(s.designer.campaigns).toHaveLength(1); // 未到期
    expect(c.supporters).toBeGreaterThanOrEqual(50); // 提前满额
    const events = tickCrowd(s, () => 0, 1); // 最后一秒到期
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: '爆款预定', ok: true });
    // 满额后继续累积：支持/100 提升每秒关注人数，720 秒远超目标
    expect(events[0].supporters).toBeGreaterThan(30 * DAY_SECONDS);
    expect(s.money).toBe(0); // 待交付，钱不动
    expect(s.designer.successCount).toBe(1);
    expect(s.designer.campaigns).toHaveLength(0);
    const f = s.designer.funded[0];
    expect(f.delivered).toBe(false);
    expect(f.income).toBe(events[0].supporters * c.price);
    expect(f.cost).toBe(events[0].supporters * c.costPrice);
    expect(events[0].income).toBe(f.income);
    expect(events[0].cost).toBe(f.cost);
  });

  it('deliverDesign：垫资 → 货款净额精确（含亏损例）；资金不足/重复交付拒绝且状态不污染', () => {
    const s = unlocked(defaultState());
    // 直接构造 funded 条目做金额精确断言
    s.designer.funded.push({ uid: 1, name: '盈利船', score: 60, rarity: 'R', price: 100, supporters: 100, cost: 4000, income: 10000, delivered: false });
    s.designer.funded.push({ uid: 2, name: '亏损船', score: 60, rarity: 'R', price: 30, supporters: 100, cost: 4200, income: 3000, delivered: false });
    // 资金不足：盈利船需垫资 4000
    s.money = 3999;
    const r0 = deliverDesign(s, 1);
    expect(r0.ok).toBe(false);
    expect(!r0.ok && r0.reason).toContain('资金不足');
    expect(s.money).toBe(3999);
    expect(s.designer.funded[0].delivered).toBe(false);
    // 正常交付（盈利）：money -= 4000 再 += 10000
    s.money = 5000;
    const r1 = deliverDesign(s, 1);
    expect(r1.ok).toBe(true);
    expect(s.money).toBe(5000 - 4000 + 10000);
    expect(s.designer.funded[0].delivered).toBe(true);
    // 亏损例（price < 成本价 42）：净 −1200
    s.money = 10000;
    const r2 = deliverDesign(s, 2);
    expect(r2.ok).toBe(true);
    expect(s.money).toBe(10000 - 4200 + 3000);
    expect(s.designer.funded[1].delivered).toBe(true);
    // 重复交付 / 不存在
    expect(deliverDesign(s, 1).ok).toBe(false);
    expect(deliverDesign(s, 999).ok).toBe(false);
    expect(s.money).toBe(10000 - 4200 + 3000);
  });

  it('端到端：众筹成功 → 待交付 → 交付净入账 支持×(售价−成本价)', () => {
    const s = unlocked(defaultState());
    s.money = 0;
    found(s, '端到端', 'euro', 'standard');
    const c = launched(s, { ratio: 2, goal: 50, days: 30 }); // 售价 = 2×成本价
    tickCrowd(s, () => 0, 30 * DAY_SECONDS);
    expect(s.money).toBe(0); // 成功也不入账
    const f = s.designer.funded[0];
    expect(f.delivered).toBe(false);
    expect(f.income).toBe(f.supporters * c.price);
    expect(f.cost).toBe(f.supporters * c.costPrice);
    s.money = f.cost; // 恰好够垫资
    expect(deliverDesign(s, f.uid).ok).toBe(true);
    expect(s.money).toBe(f.income); // 0 − cost + income
    expect(f.delivered).toBe(true);
  });

  it('到期失败：无收入、原型退回（iter 保留）、进 failed', () => {
    const s = unlocked(defaultState());
    s.money = 500;
    found(s, '生不逢时', 'euro', 'big');
    const c = launched(s, { goal: 1000, days: 30, ratio: 10 }); // p=0 无人买
    const events = tickCrowd(s, () => 0.999, 30 * DAY_SECONDS);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: '生不逢时', ok: false, supporters: 0, income: 0 });
    expect(s.money).toBe(500);
    expect(s.designer.successCount).toBe(0);
    expect(s.designer.failed).toHaveLength(1);
    expect(s.designer.prototypes).toHaveLength(1); // 原型退回
    expect(s.designer.prototypes[0].name).toBe('生不逢时');
    expect(s.designer.prototypes[0].iter).toEqual(c.iter);
  });

  it('离线复用同一逐秒函数（accumulateOffline 推进众筹）', () => {
    const s = unlocked(defaultState());
    found(s, '挂机船', 'euro', 'standard');
    launched(s);
    accumulateOffline(s, 60 * 1000, () => 0.999); // 60 秒
    expect(s.designer.campaigns[0].elapsedSec).toBe(60);
    expect(s.designer.campaigns).toHaveLength(1); // 未到期
  });

  it('存量 designed 副本 applySleeve 用体量 sleeveCost', () => {
    const s = unlocked(defaultState());
    found(s, '老牌设计', 'euro', 'big');
    launched(s);
    const copy = { uid: s.nextUid++, gameId: `design-${s.designer.campaigns[0].uid}`, durability: 80, sleeved: false, stored: false, designed: true as const };
    s.copies.push(copy);
    s.sleeves = 1000;
    const r = applySleeve(s, copy.uid);
    expect(r.ok).toBe(true);
    expect(s.sleeves).toBe(1000 - 300); // 大盒 sleeveCost
    expect(copy.sleeved).toBe(true);
  });
});

describe('设计师：成就与转生', () => {
  it('成就：灵光一现（立项）/ 一呼百应（首次成功）/ 万众瞩目（≥800 人）', () => {
    const s = unlocked(defaultState());
    expect(checkAchievements(s).map(a => a.id)).not.toContain('first-proto');
    found(s);
    expect(checkAchievements(s).map(a => a.id)).toContain('first-proto');
    expect(checkAchievements(s).map(a => a.id)).not.toContain('first-funded');
    s.money = 0;
    launched(s, { goal: 50, days: 30 });
    tickCrowd(s, () => 0, 30 * DAY_SECONDS);
    // 万众瞩目需要 funded 里有 ≥800 人的条目；本条爆款即满足（见上方断言）——同批已授予
    const ids = checkAchievements(s).map(a => a.id);
    expect(ids).toContain('first-funded');
    expect(ids).toContain('crowd-800');
  });

  it('转生重置设计师状态（不进白名单）', () => {
    const s = unlocked(defaultState());
    for (const g of ['guoyuan', 'zongming', 'kafei', 'zhitu']) own(s, g, { prof: 20 }); // 解锁转生
    found(s);
    launched(s);
    expect(doPrestige(s).ok).toBe(true);
    expect(s.designer).toEqual({
      unlocked: false, inspiration: 0, prototypes: [], campaigns: [], funded: [], failed: [], nextUid: 1, successCount: 0,
    });
  });
});

describe('设计师：存档迁移（v14/v1 → v15 v4 形态）', () => {
  it('v14 旧档 normalize 后 designer 补 v4 默认值', () => {
    const s = defaultState();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.saveVersion = 14;
    delete old.designer;
    const m = parseSave(JSON.stringify(old));
    expect(m).not.toBeNull();
    expect(m!.saveVersion).toBe(SAVE_VERSION);
    expect(m!.designer).toEqual({
      unlocked: false, inspiration: 0, prototypes: [], campaigns: [], funded: [], failed: [], nextUid: 1, successCount: 0,
    });
  });

  it('v1 旧字段兼容：prototype（invested/insp）→ iter 全 0 + 名称/体量回落；published → 并入 funded（rarity 按 score 回填）', () => {
    const s = defaultState();
    const dirty = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    dirty.saveVersion = 15;
    dirty.designer = {
      unlocked: true,
      inspiration: 42,
      // v1 形态 prototype：无 name/scale/iter，有 invested/insp
      prototypes: [
        { uid: 1, themeId: 'euro', invested: { 演算: 100 }, insp: 3 },
        { uid: 2, themeId: 'ghost', invested: { 演算: 10 }, insp: 1 }, // 未知主题剔除
      ],
      // v1 形态 published：无 rarity/scale/attrs
      published: [
        { uid: 3, name: '旧出版作', themeId: 'euro', score: 80, price: 1000, printedAt: 0, royalties: 50 },
      ],
      nextUid: 1, // 低于已用 uid，应兜底
    };
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    const d = m!.designer;
    expect(d.inspiration).toBe(42);
    expect(d.prototypes).toHaveLength(1);
    expect(d.prototypes[0]).toMatchObject({ uid: 1, themeId: 'euro', scale: 'standard' });
    expect(d.prototypes[0].name).toBeTruthy(); // 名称回落
    expect(Object.values(d.prototypes[0].iter).every(v => v === 0)).toBe(true);
    expect(d.funded).toHaveLength(1); // v1 published 并入 funded
    expect(d.funded[0]).toMatchObject({
      uid: 3, name: '旧出版作', score: 80, rarity: 'SR', price: 1000,
      supporters: 0, income: 0, cost: 0, delivered: true, // 旧数据视为已结算
    });
    expect(d.nextUid).toBeGreaterThanOrEqual(4);
    expect(d.successCount).toBeGreaterThanOrEqual(1);
  });
});
