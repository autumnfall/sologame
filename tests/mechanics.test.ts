import { describe, expect, it } from 'vitest';
import {
  defaultState, gameById,
  attrLevel, attrProgress, attrShares, gainText, jobUnlocked,
  kindCount, globalBonus, hasAffix, tierOwned, tierUnlocked, currentTier,
  expMult, fatigueIncMult, xyPriceMult, incomeMult, ticketRateMult, goldZoneWidth,
  currentJobRate,
  fatigueMod, playDuration, setupDuration, ruleDuration, masteryText, canStore, storageCost,
  fmt,
} from '../src/core';
import type { GameState } from '../src/core';

/** 让属性 attr 恰好升到 lv 级所需的经验（独立复算升级曲线） */
function expToReach(lv: number): number {
  let e = 0;
  for (let l = 0; l < lv; l++) e += Math.round(60 * Math.pow(l + 1, 1.5));
  return e;
}

/** 拥有一个 owned 条目（默认 count=1） */
function own(state: GameState, id: string, patch: Partial<GameState['owned'][string]> = {}) {
  state.owned[id] = { count: 1, prof: 0, fatigue: 0, sleeved: false, stored: false, rulesRead: false, ...patch };
  return state.owned[id];
}

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
    for (const g of gameByIdAllRegular()) own(s, g.id);
    expect(kindCount(s)).toBe(33);
    expect(globalBonus(s)).toBeCloseTo(0.495, 10);
    own(s, 'mofa'); // 第 34 种
    expect(globalBonus(s)).toBeCloseTo(0.5 + 0.01 * 0.1, 10); // 0.501
  });

  it('某宝逐级解锁：初始仅 N；集齐 N 常规款解锁 R', () => {
    const s = defaultState();
    expect(tierUnlocked(s, 'N')).toBe(true);
    expect(tierUnlocked(s, 'R')).toBe(false);
    expect(currentTier(s)).toBe('N');
    for (const g of gamesByRarityHelper('N')) own(s, g.id);
    expect(tierOwned(s, 'N')).toBe(12);
    expect(tierUnlocked(s, 'R')).toBe(true);
    expect(currentTier(s)).toBe('R');
  });

  it('隐藏款不计入解锁进度', () => {
    const s = defaultState();
    own(s, 'hezou');
    expect(tierOwned(s, 'N')).toBe(0);
    expect(tierUnlocked(s, 'R')).toBe(false);
  });

  it('hasAffix 按拥有状态判定', () => {
    const s = defaultState();
    expect(hasAffix(s, 'timeCut')).toBe(false);
    own(s, 'diguo');
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
    expect(expMult(stateWithAttrs({ 谋略: 2 }))).toBeCloseTo(1.06, 10);
    expect(incomeMult(stateWithAttrs({ 沉浸: 3 }))).toBeCloseTo(1.12, 10);
    expect(xyPriceMult(stateWithAttrs({ 运筹: 5 }))).toBeCloseTo(0.9, 10);
    expect(xyPriceMult(stateWithAttrs({ 运筹: 15 }))).toBe(0.8); // 下限
    expect(fatigueIncMult(stateWithAttrs({ 应变: 5 }))).toBeCloseTo(0.8, 10);
    expect(fatigueIncMult(stateWithAttrs({ 应变: 15 }))).toBe(0.6); // 下限
    expect(goldZoneWidth(stateWithAttrs({ 洞察: 3 }))).toBe(17);
  });

  it('黑色奏鸣曲词条：抽赏券掉率 ×1.25', () => {
    const s = defaultState();
    own(s, 'hezou');
    expect(ticketRateMult(s)).toBeCloseTo(1.25, 10);
    expect(ticketRateMult(stateWithAttrs({ 洞察: 1 }))).toBeCloseTo(1.2, 10);
  });

  it('魔法骑士词条：全属性经验 ×1.05，与谋略叠乘', () => {
    const s = stateWithAttrs({ 谋略: 1 });
    expect(expMult(s)).toBeCloseTo(1.03, 10);
    own(s, 'mofa'); // 图鉴 +1.5%
    expect(expMult(s)).toBeCloseTo(1.015 * 1.03 * 1.05, 10);
  });
});

describe('职业收入', () => {
  it('未上岗为 0；固定收入职业 = rate × 收入乘区', () => {
    expect(currentJobRate(defaultState())).toBe(0);
    const s = defaultState();
    s.job = 'clerk';
    expect(currentJobRate(s)).toBe(1.0);
    s.attrExp['沉浸'] = expToReach(2);
    expect(currentJobRate(s)).toBeCloseTo(1.08, 10);
  });

  it('主播带货波动区间：沉浸决定下限（rng 注入）', () => {
    const s = defaultState();
    s.job = 'streamer';
    expect(currentJobRate(s, () => 0)).toBeCloseTo(2.2 * 0.5, 10);
    expect(currentJobRate(s, () => 1)).toBeCloseTo(2.2 * 1.5, 10);
    s.attrExp['沉浸'] = expToReach(3);
    // ×下限0.65 ×沉浸收入1.12（无图鉴加成）
    expect(currentJobRate(s, () => 0)).toBeCloseTo(2.2 * 0.65 * 1.12, 10);
  });

  it('jobUnlocked：门槛判定', () => {
    const s = defaultState();
    expect(jobUnlocked(s, {})).toBe(true);
    expect(jobUnlocked(s, { 演算: 1 })).toBe(false);
    s.attrExp['演算'] = expToReach(1);
    expect(jobUnlocked(s, { 演算: 1 })).toBe(true);
  });
});

describe('游玩时长与疲劳', () => {
  it('疲劳收益修正：0→1，7→1/2.05，软上限 20', () => {
    const s = defaultState();
    own(s, 'guoyuan');
    expect(fatigueMod(s, gameById('guoyuan'))).toBe(1);
    own(s, 'guoyuan', { fatigue: 7 });
    expect(fatigueMod(s, gameById('guoyuan'))).toBeCloseTo(1 / 2.05, 10);
    own(s, 'guoyuan', { fatigue: 25 });
    expect(fatigueMod(s, gameById('guoyuan'))).toBeCloseTo(0.25, 10); // min(25,20)
  });

  it('熟练度曲线：首局 ×1.8，每局 -2%（下限 ×0.65），精通再减半', () => {
    const s = defaultState();
    const g = gameById('guoyuan'); // playTime 15
    own(s, 'guoyuan');
    expect(playDuration(s, g)).toBeCloseTo(27, 10); // 15×1.8
    own(s, 'guoyuan', { prof: 1 });
    expect(playDuration(s, g)).toBeCloseTo(14.7, 10); // 15×0.98
    own(s, 'guoyuan', { prof: 18 });
    expect(playDuration(s, g)).toBeCloseTo(15 * 0.65, 10); // 下限 0.65
    own(s, 'guoyuan', { prof: 20 }); // N 精通
    expect(playDuration(s, g)).toBeCloseTo(15 * 0.65 * 0.5, 10);
  });

  it('乘区叠加下限封顶 3 分钟（精通+牌套+timeCut+演算Ⅹ）', () => {
    const s = stateWithAttrs({ 演算: 10 }); // ×0.80 触底
    own(s, 'guoyuan', { prof: 20, sleeved: true });
    own(s, 'diguo'); // timeCut ×0.90
    // 15×0.65×0.5×0.85×0.90×0.80 = 2.9835 → 3
    expect(playDuration(s, gameById('guoyuan'))).toBe(3);
  });

  it('Setup：收纳 ×0.5；读规则：weight×8，读过后为 0', () => {
    const s = defaultState();
    const g = gameById('guoyuan');
    expect(setupDuration(s, g)).toBe(2);
    expect(ruleDuration(s, g)).toBeCloseTo(9.6, 10);
    own(s, 'guoyuan', { stored: true, rulesRead: true });
    expect(setupDuration(s, g)).toBe(1);
    expect(ruleDuration(s, g)).toBe(0);
  });

  it('精通文案', () => {
    const s = defaultState();
    expect(masteryText(s, gameById('guoyuan'))).toBe('');
    own(s, 'guoyuan', { prof: 5 });
    expect(masteryText(s, gameById('guoyuan'))).toBe('熟练 5/20');
    own(s, 'guoyuan', { prof: 20 });
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

describe('格式化', () => {
  it('fmt：千位以下取整，万以上缩写', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(9999.9)).toBe('9999');
    expect(fmt(10000)).toBe('1.0万');
    expect(fmt(123456)).toBe('12.3万');
  });
});

// —— 测试内部辅助（避免直接依赖被测实现）——
import { gamesByRarity } from '../src/core';
function gameByIdAllRegular() {
  return gamesByRarity('N').concat(gamesByRarity('R'), gamesByRarity('SR'), gamesByRarity('SSR'));
}
function gamesByRarityHelper(r: 'N' | 'R' | 'SR' | 'SSR') {
  return gamesByRarity(r);
}
