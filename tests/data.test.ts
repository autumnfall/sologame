import { describe, expect, it } from 'vitest';
import {
  ATTRS, FIRST_BONUS, GACHA_PITY, GACHA_PRICE, GACHA_TABLE,
  GAMES, JOBS, MARKET_SLOT_COSTS, MASTERY, REGULAR_GAMES,
  SELL_SLOT_COSTS, TAOBAO_STOCK,
  XY_REFRESH_COST, gameById, gamesByRarity, jobById, nextTier, taobaoBase,
} from '../src/core';

describe('数据集完整性', () => {
  it('id 全局唯一', () => {
    const ids = GAMES.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('总数与稀有度分布与原型一致：常规 33（N12/R8/SR9/SSR4）+ 隐藏 4', () => {
    expect(REGULAR_GAMES).toHaveLength(33);
    expect(GAMES).toHaveLength(37);
    expect(gamesByRarity('N')).toHaveLength(12);
    expect(gamesByRarity('R')).toHaveLength(8);
    expect(gamesByRarity('SR')).toHaveLength(9);
    expect(gamesByRarity('SSR')).toHaveLength(4);
    expect(GAMES.filter(g => g.hidden)).toHaveLength(4);
  });

  it('隐藏款：商店不卖/某赏不出（不在常规池）、都带词条', () => {
    for (const g of GAMES.filter(g => g.hidden)) {
      expect(REGULAR_GAMES).not.toContain(g);
      expect(g.affix?.desc).toBeTruthy();
    }
    // 四个隐藏款词条齐全
    expect(GAMES.filter(g => g.hidden).map(g => g.affix?.type).sort())
      .toEqual(['expAll', 'fatHalf', 'ticketUp', 'timeCut']);
  });

  it('每款都有卡牌张数定义（number 或 null），六维属性引用合法', () => {
    for (const g of GAMES) {
      expect(g.cards === null || typeof g.cards === 'number').toBe(true);
      expect(g.attrs.length).toBeGreaterThan(0);
      for (const a of g.attrs) expect(ATTRS).toContain(a);
    }
  });

  it('卡牌数与原型 CARDS 表一致（抽 spot check）', () => {
    expect(gameById('guoyuan').cards).toBe(36);
    expect(gameById('xueyuan').cards).toBe(200);
    expect(gameById('mori').cards).toBe(400);
    expect(gameById('mofa').cards).toBe(400);
    expect(gameById('zongming').cards).toBeNull();
    expect(gameById('kafei').cards).toBeNull();
  });

  it('职业阶梯：12 个职业、六维均衡各属性有岗、终点全属性 Ⅳ、id 唯一', () => {
    expect(JOBS).toHaveLength(12);
    const master = jobById('master');
    expect(master?.req).toEqual({ 谋略: 4, 演算: 4, 应变: 4, 运筹: 4, 洞察: 4, 沉浸: 4 });
    // 周期制：自动职业都有正周期与酬劳，最长 5 分钟
    for (const j of JOBS.filter(j => j.auto)) {
      expect(j.cycleSec).toBeGreaterThan(0);
      expect(j.cycleSec).toBeLessThanOrEqual(300);
      expect(j.cyclePay).toBeGreaterThan(0);
    }
    // 六维均衡：每个属性都至少是一个非终岗的门槛
    for (const a of ATTRS) {
      expect(JOBS.some(j => j.id !== 'master' && (j.req[a as keyof typeof j.req] ?? 0) > 0)).toBe(true);
    }
    expect(new Set(JOBS.map(j => j.id)).size).toBe(JOBS.length);
  });
});

describe('价格派生', () => {
  it('某宝基础价 = 市场价 × 0.9（四舍五入）', () => {
    expect(taobaoBase(gameById('guoyuan'))).toBe(79); // 88×0.9
    expect(taobaoBase(gameById('xueyuan'))).toBe(809); // 899×0.9
    expect(taobaoBase(gameById('zonglvdao'))).toBe(61); // 68×0.9
  });

  it('某赏单抽价锁定为 ¥100（原型 GACHA_PRICE）', () => {
    expect(GACHA_PRICE).toBe(100);
  });

  it('某赏奖池表（牌套 30/15/5 + 桌游 N30/R15/SR4/SSR1）/保底/某宝库存上限', () => {
    expect(GACHA_TABLE).toEqual([
      { kind: 'sleeves', packs: 4, p: 0.30 },
      { kind: 'sleeves', packs: 10, p: 0.15 },
      { kind: 'sleeves', packs: 20, p: 0.05 },
      { kind: 'game', rarity: 'N', p: 0.30 },
      { kind: 'game', rarity: 'R', p: 0.15 },
      { kind: 'game', rarity: 'SR', p: 0.04 },
      { kind: 'game', rarity: 'SSR', p: 0.01 },
    ]);
    expect(GACHA_PITY).toBe(50);
    expect(TAOBAO_STOCK).toEqual({ N: 4, R: 3, SR: 2, SSR: 1 });
    expect(XY_REFRESH_COST).toBe(20);
    expect(SELL_SLOT_COSTS).toEqual([500, 1500, 4000, 10000]);
    expect(MARKET_SLOT_COSTS).toEqual([200, 600, 1500, 3500]);
  });

  it('开箱奖励与精通门槛表与原型一致', () => {
    expect(FIRST_BONUS).toEqual({ N: 15, R: 30, SR: 60, SSR: 120 });
    expect(MASTERY).toEqual({ N: 20, R: 40, SR: 80, SSR: 160 });
  });

  it('稀有度下一级（SSR 封顶）', () => {
    expect(nextTier('N')).toBe('R');
    expect(nextTier('SR')).toBe('SSR');
    expect(nextTier('SSR')).toBeNull();
  });
});
