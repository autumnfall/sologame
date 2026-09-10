import { describe, expect, it } from 'vitest';
import {
  GACHA_PRICE, SLEEVE_PACK, XY_REFRESH_MS,
  accumulateOffline, applySleeve, applyStorage, buyTaobao, buyXianyu, claimOffline,
  defaultState, gachaDraw, initTaobaoStock, pickStarter, refreshXianyu,
  settleRound, takeJob, tickSecond, tickXianyu,
} from '../src/core';

/** 确定性伪随机（LCG），避免测试依赖运气 */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const own = (s: ReturnType<typeof defaultState>, id: string, patch: object = {}) => {
  s.owned[id] = { count: 1, prof: 0, fatigue: 0, sleeved: false, stored: false, rulesRead: false, ...patch };
};

describe('开局与购买', () => {
  it('pickStarter：获得桌游 + 一次性开箱奖励 + started', () => {
    const s = defaultState();
    const r = pickStarter(s, 'guoyuan');
    expect(r.ok).toBe(true);
    expect(s.started).toBe(true);
    expect(s.owned['guoyuan'].count).toBe(1);
    expect(s.attrExp['演算']).toBe(15 * 1.015); // N 开箱 15 × 自身图鉴加成
    expect(pickStarter(s, 'zongming').ok).toBe(false); // 不可重复开局
  });

  it('buyTaobao：扣款、库存 -1、重复购买拦截、级别未解锁拦截', () => {
    const s = defaultState();
    initTaobaoStock(s);
    s.money = 1000;
    const price = 88; // 绝顶聪明 98×0.9
    const r = buyTaobao(s, 'zongming');
    expect(r.ok).toBe(true);
    expect(s.money).toBe(1000 - price);
    expect(s.taobaoStock['zongming']).toBe(0);
    expect(buyTaobao(s, 'zongming').ok).toBe(false); // 已收藏
    // R 级未解锁（N 级未集齐）
    const locked = buyTaobao(s, 'yueliang');
    expect(locked.ok).toBe(false);
    expect(s.money).toBe(1000 - price); // 未扣款
    // 钱不够
    s.money = 1;
    expect(buyTaobao(s, 'kafei').ok).toBe(false);
  });

  it('集齐 N 级全部常规款 → 解锁 R 级（附 toast 文案）', () => {
    const s = defaultState();
    initTaobaoStock(s);
    s.money = 1e9;
    const nGames = ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska', 'shikong', 'boendi', 'xueyuan', 'xuankong', 'jilu', 'anake', 'xingkong'];
    for (const id of nGames.slice(0, -1)) expect(buyTaobao(s, id).ok).toBe(true);
    const last = buyTaobao(s, nGames[11]);
    expect(last.ok).toBe(true);
    expect(last.ok && last.message).toContain('解锁 R 级货架');
    expect(buyTaobao(s, 'yueliang').ok).toBe(true); // R 级可买
  });

  it('applySleeve / applyStorage', () => {
    const s = defaultState();
    own(s, 'guoyuan'); // 需 36 张
    const r = applySleeve(s, 'guoyuan');
    expect(r.ok).toBe(true);
    expect(s.sleeves).toBe(100 - 36);
    expect(s.owned['guoyuan'].sleeved).toBe(true);
    expect(applySleeve(s, 'guoyuan').ok).toBe(false); // 已套
    expect(applySleeve(s, 'kafei').ok).toBe(false); // 无卡牌
    s.money = 1000;
    own(s, 'xueyuan'); // 大盒可收纳，费用 809×0.2=162
    expect(applyStorage(s, 'xueyuan').ok).toBe(true);
    expect(s.money).toBe(838);
    expect(applyStorage(s, 'guoyuan').ok).toBe(false); // 88 元小盒不可收纳
  });
});

describe('某鱼', () => {
  it('刷新：3~5 件、批内去重、价格区间、排定下次到货', () => {
    const s = defaultState();
    s.money = 100;
    const now = 1_000_000;
    const r = refreshXianyu(s, true, lcg(42), now);
    expect(r.ok).toBe(true);
    expect(s.money).toBe(80); // 扣 ¥20
    const items = s.xianyu;
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    for (const it of items) {
      expect(it.price).toBeGreaterThanOrEqual(10);
    }
    expect(s.xyNext).toBe(now + XY_REFRESH_MS);
  });

  it('免费刷新不扣钱；钱不够时拒绝', () => {
    const s = defaultState();
    s.money = 10;
    expect(refreshXianyu(s, true, lcg(7)).ok).toBe(false);
    expect(refreshXianyu(s, false, lcg(7)).ok).toBe(true);
    expect(s.money).toBe(10);
  });

  it('已精通桌游不再刷出', () => {
    const s = defaultState();
    own(s, 'guoyuan', { prof: 20 }); // N 精通
    const r = refreshXianyu(s, false, lcg(99), 0);
    expect(r.items!.every(i => i.id !== 'guoyuan')).toBe(true);
  });

  it('tickXianyu：到点才刷新；buyXianyu：扣款、下架、已拥有拦截', () => {
    const s = defaultState();
    refreshXianyu(s, false, lcg(5), 0);
    const future = s.xyNext - 1;
    expect(tickXianyu(s, lcg(5), future)).toBe(false);
    expect(tickXianyu(s, lcg(5), s.xyNext)).toBe(true);

    const id = s.xianyu[0].id;
    s.money = 1e9;
    const r = buyXianyu(s, 0);
    expect(r.ok).toBe(true);
    expect(s.owned[id].count).toBe(1);
    expect(s.xianyu.find(i => i.id === id)).toBeUndefined();
    // 补回一件再验证已拥有拦截
    refreshXianyu(s, false, lcg(11), 0);
    const idx = s.xianyu.findIndex(i => i.id === id);
    if (idx >= 0) expect(buyXianyu(s, idx).ok).toBe(false);
  });
});

describe('某赏', () => {
  it('花钱单抽：扣款、保底进度、首次获得入收藏', () => {
    const s = defaultState();
    s.money = GACHA_PRICE;
    const r = gachaDraw(s, false, () => 0.999); // 0.999 → N 档（累加 0.98 后落到 N）
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(s.money).toBe(0);
    expect(s.pity).toBe(1);
    expect(s.stats.pulls).toBe(1);
    if (!r.duplicate) {
      expect(s.owned[r.gameId].count).toBe(1);
    }
  });

  it('抽赏券单抽：不扣钱；没券报错', () => {
    const s = defaultState();
    s.tickets = 1;
    const r = gachaDraw(s, true, lcg(3));
    expect('error' in r).toBe(false);
    expect(s.tickets).toBe(0);
    expect(s.money).toBe(200);
    expect('error' in gachaDraw(s, true, lcg(3))).toBe(true);
  });

  it('49 抽后硬保底 SSR，出 SSR 后保底清零', () => {
    const s = defaultState();
    s.pity = 49;
    s.money = 1e9;
    const r = gachaDraw(s, false, () => 0); // 强制 SSR，池第一个 = 灵迹岛
    if ('error' in r) throw new Error('unexpected error');
    expect(r.rarity).toBe('SSR');
    expect(r.gameId).toBe('lingji');
    expect(s.pity).toBe(0);
    expect(s.owned['lingji'].count).toBe(1);
  });

  it('重复 SSR → 转牌套 40 包 + 熟练度 +32', () => {
    const s = defaultState();
    for (const id of ['lingji', 'aoding', 'fangzhou', 'guizhen']) own(s, id);
    s.pity = 49;
    s.sleeves = 0;
    const r = gachaDraw(s, false, () => 0);
    if ('error' in r) throw new Error('unexpected error');
    expect(r.duplicate).toBe(true);
    if (r.duplicate) {
      expect(r.sleeveSheets).toBe(40 * SLEEVE_PACK);
      expect(r.profGain).toBe(32);
    }
    expect(s.sleeves).toBe(40 * SLEEVE_PACK);
    expect(s.owned['lingji'].prof).toBe(32);
  });
});

describe('tick 与离线', () => {
  it('tickSecond：按职业产钱；固定 rng 下无随机事件', () => {
    const s = defaultState();
    expect(tickSecond(s, () => 0.5).income).toBe(0); // 无职业
    takeJob(s, 'clerk');
    const r = tickSecond(s, () => 0.9);
    expect(r.income).toBeCloseTo(1.0, 10);
    expect(r.ticketDrop).toBe(false);
    expect(r.streamEvent).toBeNull();
    expect(s.money).toBe(201);
  });

  it('离线累积：按基础期望结算、上限 1 小时、bank 满则停', () => {
    const s = defaultState();
    takeJob(s, 'clerk');
    accumulateOffline(s, 30 * 60 * 1000); // 30 分钟
    expect(s.offlineBank.t).toBe(1800 * 1000);
    expect(s.offlineBank.money).toBeCloseTo(1800, 6); // ¥1/秒
    accumulateOffline(s, 2 * 3600 * 1000); // 再来 2 小时，封顶
    expect(s.offlineBank.t).toBe(3600 * 1000);
    expect(s.offlineBank.money).toBeCloseTo(3600, 6);
    accumulateOffline(s, 60000); // 已满，不再累积
    expect(s.offlineBank.t).toBe(3600 * 1000);
    const got = claimOffline(s);
    expect(got).toBeCloseTo(3600, 6);
    expect(s.offlineBank.money).toBe(0);
  });

  it('无自动职业时离线不累积', () => {
    const s = defaultState();
    accumulateOffline(s, 3600 * 1000);
    expect(s.offlineBank.t).toBe(0);
  });
});

describe('游玩结算', () => {
  it('结算：疲劳 ±、熟练度、经验按属性分摊、试玩员收入、掉券', () => {
    const s = defaultState();
    own(s, 'guoyuan'); // 单属性 演算 12
    own(s, 'boendi', { fatigue: 5 });
    // 原型语义：先加疲劳（0→2）再结算，且吃 2 种图鉴加成 1.03
    const r = settleRound(s, 'guoyuan', 1, () => 0.99); // 不掉券
    expect(r.gains['演算']).toBeCloseTo((12 / 1.3) * 1.03, 10);
    expect(r.pay).toBe(Math.round((8 + 12 * 0.8) * (1 / 1.3) * 1.03)); // ≈14
    expect(s.owned['guoyuan'].fatigue).toBe(2);
    expect(s.owned['guoyuan'].prof).toBe(1);
    expect(s.owned['guoyuan'].rulesRead).toBe(true);
    expect(s.owned['boendi'].fatigue).toBe(4); // 5-1
    expect(s.stats.plays).toBe(1);
    expect(r.tired).toBe(false);

    // 洞察 Ⅰ + 黑色奏鸣曲 → 掉券率 0.06×1.2×1.25=0.09，rng 0 必掉
    s.attrExp['洞察'] = 60;
    own(s, 'hezou');
    const r2 = settleRound(s, 'guoyuan', 2, () => 0);
    expect(r2.ticketDrop).toBe(true);
    expect(s.tickets).toBe(1);
  });

  it('疲劳收益衰减计入经验与收入；玩腻了阈值 7', () => {
    const s = defaultState();
    own(s, 'guoyuan', { fatigue: 7 });
    const r = settleRound(s, 'guoyuan', 1, () => 0.99);
    expect(r.tired).toBe(true);
    // 疲劳先增至 9：12/2.35 × 自身图鉴 1.015
    expect(r.gains['演算']).toBeCloseTo((12 / 2.35) * 1.015, 6);
  });

  it('20强词条：疲劳增长减半（+2 → +1）', () => {
    const s = defaultState();
    own(s, 'guoyuan');
    own(s, 'ershiqiang');
    settleRound(s, 'guoyuan', 1, () => 0.99);
    expect(s.owned['guoyuan'].fatigue).toBe(1);
  });

  it('多属性桌游经验按份额分摊（勃艮第 65/35）', () => {
    const s = defaultState();
    own(s, 'boendi');
    const r = settleRound(s, 'boendi', 1, () => 0.99);
    // 疲劳 0→2（÷1.3）× 自身图鉴 1.015
    expect(r.gains['谋略']).toBeCloseTo(28 * 0.65 * (1 / 1.3) * 1.015, 6);
    expect(r.gains['应变']).toBeCloseTo(28 * 0.35 * (1 / 1.3) * 1.015, 6);
    expect(s.attrExp['谋略']).toBeCloseTo(28 * 0.65 * (1 / 1.3) * 1.015, 6);
  });
});
