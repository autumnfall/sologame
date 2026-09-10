import { describe, expect, it } from 'vitest';
import {
  DURABILITY, conditionText, copyValue, defaultState, durabilityRatio, fmt, gameById,
  gamesByRarity, playWear, sellChance, STORE_WEAR_ONCE,
  attrLevel, attrProgress, attrShares, gainText, jobUnlocked,
  kindCount, globalBonus, hasAffix, tierOwned, tierUnlocked, currentTier,
  expMult, fatigueIncMult, xyPriceMult, incomeMult, ticketRateMult, goldZoneWidth,
  sellFeeRate, jobCyclePay, jobCyclePayExpected, jobById, currentJob,
  fatigueMod, playDuration, setupDuration, ruleDuration, masteryText, canStore, storageCost,
} from '../src/core';
import { expToReach, open, own } from './helpers';
import type { GameState } from '../src/core';

function stateWithAttrs(levels: Partial<Record<keyof GameState['attrExp'], number>>): GameState {
  const s = defaultState();
  for (const [a, lv] of Object.entries(levels)) {
    s.attrExp[a as keyof GameState['attrExp']] = expToReach(lv);
  }
  return s;
}

describe('属性曲线与经验分摊', () => {
  it('升级曲线：60 → 170 → 312（与教程页文案一致）', () => {
    const s = defaultState();
    expect(attrProgress(s, '谋略')).toEqual({ lv: 0, cur: 0, need: 60 });
    s.attrExp['谋略'] = 60;
    expect(attrProgress(s, '谋略')).toEqual({ lv: 1, cur: 0, need: 170 });
    s.attrExp['谋略'] = 230; // 60+170
    expect(attrProgress(s, '谋略')).toEqual({ lv: 2, cur: 0, need: 312 });
  });

  it('经验分摊比例：单/双/三/四/六属性', () => {
    expect(attrShares(gameById('guoyuan'))).toEqual([1]);
    expect(attrShares(gameById('boendi'))).toEqual([0.65, 0.35]);
    expect(attrShares(gameById('haigu'))).toEqual([0.5, 0.3, 0.2]);
    expect(attrShares(gameById('lingji'))).toEqual([0.4, 0.3, 0.2, 0.1]);
    expect(attrShares(gameById('mofa'))).toEqual([0.2, 0.2, 0.15, 0.15, 0.15, 0.15]);
  });

  it('gainText：双属性 65/35 取整（勃艮第 28 → 18/10）', () => {
    expect(gainText(gameById('boendi'))).toBe('🧠谋略+18 🎲应变+10');
    expect(gainText(gameById('guoyuan'))).toBe('📐演算+12');
  });

  it('expToReach 辅助函数与实现曲线吻合', () => {
    const s = defaultState();
    s.attrExp['沉浸'] = expToReach(5);
    expect(attrLevel(s, '沉浸')).toBe(5);
  });
});

describe('图鉴加成与稀有度解锁', () => {
  it('空图鉴 0 加成；33 种恰好 49.5%（未触顶）；34 种触顶递减', () => {
    const s = defaultState();
    expect(globalBonus(s)).toBe(0);
    for (const g of gamesByRarity('N').concat(gamesByRarity('R'), gamesByRarity('SR'), gamesByRarity('SSR'))) {
      open(s, g.id);
    }
    expect(kindCount(s)).toBe(33);
    expect(globalBonus(s)).toBeCloseTo(0.495, 10);
    open(s, 'mofa'); // 第 34 种
    expect(globalBonus(s)).toBeCloseTo(0.5 + 0.01 * 0.1, 10); // 0.501
  });

  it('某宝逐级解锁：初始仅 N；集齐 N 常规款解锁 R', () => {
    const s = defaultState();
    expect(tierUnlocked(s, 'N')).toBe(true);
    expect(tierUnlocked(s, 'R')).toBe(false);
    expect(currentTier(s)).toBe('N');
    for (const g of gamesByRarity('N')) open(s, g.id);
    expect(tierOwned(s, 'N')).toBe(12);
    expect(tierUnlocked(s, 'R')).toBe(true);
    expect(currentTier(s)).toBe('R');
  });

  it('隐藏款不计入解锁进度', () => {
    const s = defaultState();
    open(s, 'hezou');
    expect(tierOwned(s, 'N')).toBe(0);
    expect(tierUnlocked(s, 'R')).toBe(false);
  });

  it('hasAffix 按收藏判定（与实体去留无关）', () => {
    const s = defaultState();
    expect(hasAffix(s, 'timeCut')).toBe(false);
    open(s, 'diguo');
    expect(hasAffix(s, 'timeCut')).toBe(true);
    expect(hasAffix(s, 'fatHalf')).toBe(false);
  });
});

describe('六维乘区', () => {
  it('新档所有倍率为基准值', () => {
    const s = defaultState();
    expect(expMult(s)).toBe(1);
    expect(fatigueIncMult(s)).toBe(1);
    expect(xyPriceMult(s)).toBe(1);
    expect(incomeMult(s)).toBe(1);
    expect(ticketRateMult(s)).toBe(1);
    expect(goldZoneWidth(s)).toBe(14);
  });

  it('谋略/沉浸按级线性；运筹与应变有下限', () => {
    expect(expMult(stateWithAttrs({ 谋略: 2 }))).toBeCloseTo(1.05, 10);
    expect(incomeMult(stateWithAttrs({ 沉浸: 3 }))).toBeCloseTo(1.12, 10);
    expect(xyPriceMult(stateWithAttrs({ 运筹: 5 }))).toBeCloseTo(0.9, 10);
    expect(xyPriceMult(stateWithAttrs({ 运筹: 15 }))).toBe(0.8); // 下限
    expect(fatigueIncMult(stateWithAttrs({ 应变: 5 }))).toBeCloseTo(0.8, 10);
    expect(fatigueIncMult(stateWithAttrs({ 应变: 15 }))).toBe(0.6); // 下限
    expect(goldZoneWidth(stateWithAttrs({ 洞察: 3 }))).toBe(20);
    expect(goldZoneWidth(stateWithAttrs({ 洞察: 20 }))).toBe(40); // 上限
  });

  it('黑色奏鸣曲词条：抽赏券掉率 ×1.25（与洞察叠乘）', () => {
    const s = defaultState();
    open(s, 'hezou');
    expect(ticketRateMult(s)).toBeCloseTo(1.25, 10);
    expect(ticketRateMult(stateWithAttrs({ 洞察: 1 }))).toBeCloseTo(1.1, 10);
    expect(ticketRateMult(stateWithAttrs({ 洞察: 10 }))).toBeCloseTo(2, 10);
  });

  it('魔法骑士词条：全属性经验 ×1.05，与谋略叠乘', () => {
    const s = stateWithAttrs({ 谋略: 1 });
    expect(expMult(s)).toBeCloseTo(1.025, 10);
    open(s, 'mofa'); // 图鉴 +1.5%
    expect(expMult(s)).toBeCloseTo(1.015 * 1.025 * 1.05, 10);
  });
});

describe('职业收入（周期制）', () => {
  it('未上岗无周期；固定酬劳职业 = cyclePay（不吃收入乘区）', () => {
    const s = defaultState();
    expect(currentJob(s)).toBeUndefined();
    const teacher = jobById('teacher')!;
    expect(jobCyclePay(s, teacher)).toBe(50);
    s.attrExp['沉浸'] = expToReach(2);
    expect(incomeMult(s)).toBeCloseTo(1.08, 10); // 沉浸只加游玩收入
    expect(jobCyclePay(s, teacher)).toBe(50); // 不影响工作酬劳
    expect(jobCyclePayExpected(s, teacher)).toBe(50);
  });

  it('主播带货波动：沉浸决定下限（rng 注入）；期望随沉浸上移', () => {
    const s = defaultState();
    const streamer = jobById('streamer')!;
    expect(jobCyclePay(s, streamer, () => 0)).toBe(Math.round(100 * 0.5));
    expect(jobCyclePay(s, streamer, () => 1)).toBe(Math.round(100 * 1.5));
    expect(jobCyclePayExpected(s, streamer)).toBeCloseTo(100, 10); // (0.5+1.5)/2
    s.attrExp['沉浸'] = expToReach(3);
    expect(jobCyclePay(s, streamer, () => 0)).toBe(Math.round(100 * 0.65));
    expect(jobCyclePayExpected(s, streamer)).toBeCloseTo(100 * (0.65 + 1.5) / 2, 6);
  });

  it('运筹减免成交手续费：每级 -0.5%，10 级全免', () => {
    expect(sellFeeRate(defaultState())).toBeCloseTo(0.05, 10);
    expect(sellFeeRate(stateWithAttrs({ 运筹: 5 }))).toBeCloseTo(0.025, 10);
    expect(sellFeeRate(stateWithAttrs({ 运筹: 10 }))).toBe(0);
    expect(sellFeeRate(stateWithAttrs({ 运筹: 20 }))).toBe(0); // 下限 0
  });

  it('jobUnlocked：门槛判定', () => {
    const s = defaultState();
    expect(jobUnlocked(s, {})).toBe(true);
    expect(jobUnlocked(s, { 演算: 1 })).toBe(false);
    s.attrExp['演算'] = expToReach(1);
    expect(jobUnlocked(s, { 演算: 1 })).toBe(true);
  });
});

describe('游玩时长与疲劳（收藏级 + 实体级）', () => {
  it('疲劳收益修正：0→1，7→1/2.05，软上限 20', () => {
    const s = defaultState();
    open(s, 'guoyuan');
    expect(fatigueMod(s, gameById('guoyuan'))).toBe(1);
    open(s, 'guoyuan', { fatigue: 7 });
    expect(fatigueMod(s, gameById('guoyuan'))).toBeCloseTo(1 / 2.05, 10);
    open(s, 'guoyuan', { fatigue: 25 });
    expect(fatigueMod(s, gameById('guoyuan'))).toBeCloseTo(0.25, 10); // min(25,20)
  });

  it('熟练度曲线：首局 ×1.8，每局 -2%（下限 ×0.65），精通再减半', () => {
    const s = defaultState();
    const g = gameById('guoyuan'); // playTime 15
    own(s, 'guoyuan');
    const c = s.copies[0];
    expect(playDuration(s, g, c)).toBeCloseTo(27, 10); // 15×1.8
    open(s, 'guoyuan', { prof: 1 });
    expect(playDuration(s, g, c)).toBeCloseTo(14.7, 10); // 15×0.98
    open(s, 'guoyuan', { prof: 18 });
    expect(playDuration(s, g, c)).toBeCloseTo(15 * 0.65, 10); // 下限 0.65
    open(s, 'guoyuan', { prof: 20 }); // N 精通
    expect(playDuration(s, g, c)).toBeCloseTo(15 * 0.65 * 0.5, 10);
  });

  it('牌套（实体级）×0.85；乘区叠加下限封顶 3 分钟', () => {
    const s = stateWithAttrs({ 演算: 10 }); // ×0.80 触底
    own(s, 'guoyuan', { prof: 20, sleeved: true });
    open(s, 'diguo'); // timeCut ×0.90
    const g = gameById('guoyuan');
    // 15×0.65×0.5×0.85×0.90×0.80 = 2.9835 → 3
    expect(playDuration(s, g, s.copies[0])).toBe(3);
  });

  it('Setup：收纳（实体级）×0.5；读规则（收藏级）weight×8，读过后为 0', () => {
    const s = defaultState();
    const g = gameById('guoyuan');
    expect(setupDuration(s, g)).toBe(2);
    expect(ruleDuration(s, g)).toBeCloseTo(9.6, 10);
    own(s, 'guoyuan', { stored: true, rulesRead: true });
    expect(setupDuration(s, g, s.copies[0])).toBe(1);
    expect(ruleDuration(s, g)).toBe(0);
  });

  it('精通文案（收藏级）', () => {
    const s = defaultState();
    expect(masteryText(s, gameById('guoyuan'))).toBe('');
    open(s, 'guoyuan', { prof: 5 });
    expect(masteryText(s, gameById('guoyuan'))).toBe('熟练 5/20');
    open(s, 'guoyuan', { prof: 20 });
    expect(masteryText(s, gameById('guoyuan'))).toBe('⭐已精通（时长×0.5）');
  });
});

describe('收藏架操作', () => {
  it('收纳资格与费用（基础价 ×0.2 取整）', () => {
    expect(canStore(gameById('guoyuan'))).toBe(false); // 88 元小盒
    expect(canStore(gameById('xueyuan'))).toBe(true); // 大盒
    expect(canStore(gameById('anake'))).toBe(true); // 328 元
    expect(storageCost(gameById('guoyuan'))).toBe(16); // 79×0.2
    expect(storageCost(gameById('xueyuan'))).toBe(162); // 809×0.2
  });
});

describe('成色 / 耐久 / 价值', () => {
  it('耐久比与成色文案：满 = 全新，0 = 5成新', () => {
    expect(durabilityRatio(10, 'N')).toBe(1);
    expect(durabilityRatio(0, 'N')).toBe(0);
    expect(durabilityRatio(5, 'N')).toBe(0.5);
    expect(conditionText(10, 'N')).toBe('全新');
    expect(conditionText(0, 'N')).toBe('5成新');
    expect(conditionText(5, 'N')).toBe('7成新'); // floor(5+2.5)
    expect(DURABILITY).toEqual({ N: 10, R: 20, SR: 40, SSR: 80 });
  });

  it('单次磨损：基础 1，收纳 ×0.75，牌套 ×0.5（叠乘）', () => {
    expect(playWear(false, false)).toBe(1);
    expect(playWear(true, false)).toBe(0.75);
    expect(playWear(false, true)).toBe(0.5);
    expect(playWear(true, true)).toBe(0.375);
    expect(STORE_WEAR_ONCE).toEqual({ N: 1, R: 2, SR: 3, SSR: 4 }); // 收纳一次性扣耐久
  });

  it('实体价值：成色基础 + 收纳 20% + 牌套每 50 张 10 元', () => {
    const v = (dur: number, sleeved = false, stored = false) =>
      copyValue(88, 36, dur, 'N', sleeved, stored); // 果园
    expect(v(10)).toBe(88); // 全新：88×1.0
    expect(v(0)).toBe(44); // 5成新：88×0.5
    expect(v(5)).toBe(66); // 88×0.75
    expect(v(10, false, true)).toBe(88 + 18); // +收纳 88×0.2
    expect(v(10, true, false)).toBe(88 + 10); // +牌套 ceil(36/50)×10
    // 血源：899 元、200 张牌，SSR 满耐久带牌套+收纳
    expect(copyValue(899, 200, 80, 'SSR', true, true))
      .toBe(Math.round(899 + 899 * 0.2 + Math.ceil(200 / 50) * 10));
  });

  it('出售概率：全新×50% 必卖，0耐久×200% 必不卖，中间线性', () => {
    expect(sellChance(0.5, 10, 'N')).toBe(1);
    expect(sellChance(2.0, 0, 'N')).toBe(0);
    expect(sellChance(1.0, 5, 'N')).toBeCloseTo(0.5 * 0.75, 10); // (1.5-1)×(0.5+0.25)
    expect(sellChance(1.5, 10, 'N')).toBeCloseTo(0, 10);
  });
});

describe('格式化', () => {
  it('fmt：千位以下取整，万以上缩写', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(9999.9)).toBe('9999');
    expect(fmt(10000)).toBe('1.0万');
    expect(fmt(123456)).toBe('12.3万');
  });
});
