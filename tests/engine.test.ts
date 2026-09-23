import { describe, expect, it } from 'vitest';
import {
  DURABILITY, GAMES, HI_TICKET_SLEEVES, MARKET_SLOT_COSTS, REGULAR_GAMES, ROTATION_MS,
  SELL_FEE, SELL_SLOT_COSTS, STORE_WEAR_ONCE, XY_REFRESH_MS, XY_SELL_MS,
  accumulateOffline, applySleeve, applyStorage, buyTaobao, buyXianyu,
  copyValue, defaultState, exchangeHiTickets, expandMarketSlots, expandSellSlots, expMult, gachaDraw,
  gameById, initTaobaoStock, listCopy, listWornCopies, pickStarter, quitJob, refreshXianyu, rollGachaOutcome, rollGameRarity, rotatingPool, settleRound,
  takeJob, tickRotation, tickSecond, tickXianyu, toggleLock, unlistCopy,
} from '../src/core';
import { lcg, own, uidOf } from './helpers';

const N_GAMES = ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska', 'shikong', 'boendi', 'xueyuan', 'xuankong', 'jilu', 'anake', 'xingkong'];

describe('开局与购买', () => {
  it('pickStarter：获得全新实体 + 一次性开箱奖励 + started', () => {
    const s = defaultState();
    const r = pickStarter(s, 'guoyuan');
    expect(r.ok).toBe(true);
    expect(s.started).toBe(true);
    expect(s.collections['guoyuan'].firstOpened).toBe(true);
    expect(s.copies).toHaveLength(1);
    expect(s.copies[0].durability).toBe(DURABILITY.N);
    expect(s.attrExp['演算']).toBe(15 * 1.015); // N 开箱 15 × 自身图鉴加成
    expect(pickStarter(s, 'zongming').ok).toBe(false); // 不可重复开局
  });

  it('某宝：每款限量 4/3/2/1 次，售完不补；重复购买不再给开箱奖励', () => {
    const s = defaultState();
    initTaobaoStock(s);
    s.money = 1e9;
    // N 级可买 4 次
    for (let i = 0; i < 4; i++) expect(buyTaobao(s, 'zongming').ok).toBe(true);
    expect(s.copies.filter(c => c.gameId === 'zongming')).toHaveLength(4);
    expect(buyTaobao(s, 'zongming').ok).toBe(false); // 售罄
    expect(s.attrExp['应变']).toBeCloseTo(15 * 1.015, 6); // 只有第一次给开箱
    // R 级未解锁
    expect(buyTaobao(s, 'yueliang').ok).toBe(false);
  });

  it('集齐 N 级全部常规款 → 解锁 R 级（按开箱进度，与购买次数无关）', () => {
    const s = defaultState();
    initTaobaoStock(s);
    s.money = 1e9;
    for (const id of N_GAMES.slice(0, -1)) expect(buyTaobao(s, id).ok).toBe(true);
    const last = buyTaobao(s, N_GAMES[11]);
    expect(last.ok && last.message).toContain('解锁 R 级货架');
    expect(buyTaobao(s, 'yueliang').ok).toBe(true); // R 级可买，限量 3
    for (let i = 0; i < 2; i++) expect(buyTaobao(s, 'yueliang').ok).toBe(true);
    expect(buyTaobao(s, 'yueliang').ok).toBe(false); // R 级第 4 次被拒
  });

  it('applySleeve / applyStorage（实体级，按 uid）', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan'); // 需 36 张
    const r = applySleeve(s, copy.uid);
    expect(r.ok).toBe(true);
    expect(s.sleeves).toBe(100 - 36);
    expect(copy.sleeved).toBe(true);
    expect(applySleeve(s, copy.uid).ok).toBe(false); // 已套
    s.money = 1000;
    const xue = own(s, 'xueyuan'); // 大盒可收纳，162
    expect(xue.durability).toBe(DURABILITY.N);
    expect(applyStorage(s, xue.uid).ok).toBe(true);
    expect(s.money).toBe(838);
    expect(xue.stored).toBe(true);
    expect(xue.durability).toBe(DURABILITY.N - STORE_WEAR_ONCE.N); // 一次性扣 1
    expect(applyStorage(s, copy.uid).ok).toBe(false); // 小盒不可收纳
    expect(applySleeve(s, 999).ok).toBe(false); // 不存在
  });
});

describe('某鱼：购买与出售', () => {
  it('刷新：普通货源件数 = marketSlots（默认 3）+ 1 件一口价盲买，批内不重复，排定下次到货', () => {
    const s = defaultState();
    s.money = 100;
    const now = 1_000_000;
    const r = refreshXianyu(s, true, lcg(42), now);
    expect(r.ok).toBe(true);
    expect(s.money).toBe(80); // 扣 ¥20
    expect(s.xianyuBuys).toHaveLength(4); // 3 普通 + 1 一口价
    expect(new Set(s.xianyuBuys.map(i => i.gameId)).size).toBe(4);
    const blinds = s.xianyuBuys.filter(i => i.blind);
    expect(blinds).toHaveLength(1); // 每次刷新必定恰好一件一口价
    for (const it of s.xianyuBuys) {
      expect(it.price).toBeGreaterThanOrEqual(10);
      expect(it.durability).toBeGreaterThan(0);
    }
    expect(s.xyNext).toBe(now + XY_REFRESH_MS);
  });

  it('一口价盲买：价格为总价值 80%~120%，购买后揭示实体成色', () => {
    const s = defaultState();
    refreshXianyu(s, false, lcg(7), 0);
    const idx = s.xianyuBuys.findIndex(i => i.blind);
    expect(idx).toBeGreaterThanOrEqual(0);
    const it = s.xianyuBuys[idx];
    const g = gameById(it.gameId);
    const value = copyValue(g.marketPrice, g.cards, it.durability, g.rarity, it.sleeved, it.stored);
    expect(it.price).toBeGreaterThanOrEqual(Math.round(value * 0.8) - 1); // 含取整误差
    expect(it.price).toBeLessThanOrEqual(Math.round(value * 1.2) + 1);
    s.money = 1e9;
    const r = buyXianyu(s, idx);
    expect(r.ok).toBe(true);
    expect(r.blind).toBe(true);
    const copy = s.copies.find(c => c.gameId === r.gameId)!;
    expect(copy.durability).toBe(it.durability); // 按隐藏的成色入实体
    expect(copy.sleeved).toBe(it.sleeved);
    expect(copy.stored).toBe(it.stored);
  });

  it('扩充市场货架：3→4 件，扣对应费用', () => {
    const s = defaultState();
    s.money = 10000;
    const r = expandMarketSlots(s);
    expect(r.ok && r.message).toContain('4 件');
    expect(s.marketSlots).toBe(4);
    expect(s.money).toBe(10000 - MARKET_SLOT_COSTS[0]);
    const rr = refreshXianyu(s, false, lcg(8), 0);
    expect(rr.items).toHaveLength(5); // 4 普通 + 1 一口价
    expect(rr.items!.filter(i => !i.blind)).toHaveLength(4);
  });

  it('购买货源：按成色入实体（含牌套/收纳），收藏级进度保留', () => {
    const s = defaultState();
    refreshXianyu(s, false, lcg(5), 0);
    const item0 = s.xianyuBuys[0];
    s.money = 1e9;
    const first = buyXianyu(s, 0);
    expect(first.ok).toBe(true);
    const copy = s.copies.find(c => c.gameId === first.gameId)!;
    expect(copy.durability).toBe(item0.durability);
    expect(copy.sleeved).toBe(item0.sleeved);
    expect(copy.stored).toBe(item0.stored);
    // 收藏级进度写入（卖光重买不丢）
    s.collections[first.gameId!].prof = 7;
    expect(s.collections[first.gameId!].firstOpened).toBe(true);
  });

  it('上架/下架/槽位上限', () => {
    const s = defaultState();
    const a = own(s, 'guoyuan');
    const b = own(s, 'zongming');
    // 默认 1 个出售槽位
    expect(listCopy(s, a.uid, 1.0).ok).toBe(true);
    expect(listCopy(s, b.uid, 1.0).ok).toBe(false); // 槽位满
    expect(listCopy(s, a.uid, 1.0).ok).toBe(false); // 重复上架
    expect(listCopy(s, a.uid, 0.3).ok).toBe(false); // 低于 50%
    expect(listCopy(s, a.uid, 2.5).ok).toBe(false); // 高于 200%
    expect(unlistCopy(s, a.uid).ok).toBe(true);
    expect(s.listings).toHaveLength(0);
    expect(listCopy(s, b.uid, 1.0).ok).toBe(true); // 下架后可换别的上架
    // 扩充出售槽位
    s.money = SELL_SLOT_COSTS[0];
    expect(expandSellSlots(s).ok).toBe(true);
    expect(s.sellSlots).toBe(2);
    expect(s.money).toBe(0);
  });

  it('实体锁定：锁定后不可上架，解锁恢复；一键上架磨光件跳过锁定实体', () => {
    const s = defaultState();
    const a = own(s, 'guoyuan', { durability: 0 });
    const b = own(s, 'kafei', { durability: 0 });
    s.money = 999;
    expandSellSlots(s); // 2 槽
    expect(toggleLock(s, a.uid).ok).toBe(true);
    expect(s.copies.find(c => c.uid === a.uid)!.locked).toBe(true);
    expect(listCopy(s, a.uid, 1.0).ok).toBe(false); // 锁定不可出售
    const r = listWornCopies(s);
    expect(r.count).toBe(1); // 只上架未锁定的磨光件
    expect(s.listings[0].copyUid).toBe(b.uid);
    expect(toggleLock(s, a.uid).ok).toBe(true); // 解锁
    expect(listCopy(s, a.uid, 1.0).ok).toBe(true);
    // 上架中的实体不可锁定/解锁
    expect(toggleLock(s, a.uid).ok).toBe(false);
  });

  it('成交判定：全新×50% 必卖（扣 5% 手续费）；0耐久×200% 必不卖', () => {
    // 必卖：上架后手动把耐久打满、定价倍率 0.5
    const s = defaultState();
    const c = own(s, 'guoyuan'); // 全新 88 价值
    expect(listCopy(s, c.uid, 0.5).ok).toBe(true); // ¥44
    s.xySellNext = 1; // 立即判定
    const r = tickXianyu(s, () => 0.3, 100);
    expect(r.sold).toHaveLength(1);
    expect(r.sold[0].gain).toBe(Math.round(44 * (1 - SELL_FEE))); // 41.8→42
    expect(s.money).toBe(200 + Math.round(44 * 0.95));
    expect(s.copies).toHaveLength(0); // 实体已交割
    expect(s.collections['guoyuan'].firstOpened).toBe(true); // 收藏进度保留

    // 必不卖：0 耐久 ×200%
    const s2 = defaultState();
    const c2 = own(s2, 'guoyuan', { durability: 0 });
    expect(listCopy(s2, c2.uid, 2.0).ok).toBe(true);
    s2.xySellNext = 1;
    const r2 = tickXianyu(s2, () => 0.0, 100); // rng 0 都卖不掉
    expect(r2.sold).toHaveLength(0);
    expect(s2.copies).toHaveLength(1);
  });

  it('tickXianyu：货源 5 分钟刷新与挂售 30s 判定互相独立', () => {
    const s = defaultState();
    refreshXianyu(s, false, lcg(5), 0);
    // 必卖上架（全新×50%）
    const c = own(s, 'guoyuan');
    expect(listCopy(s, c.uid, 0.5).ok).toBe(true);
    // 判定时钟未初始化：首个 tick 只武装不判定
    expect(tickXianyu(s, () => 0, 100).sold).toHaveLength(0);
    expect(s.listings).toHaveLength(1);
    // 30s 到点：判定成交，但货源尚未到 5 分钟不刷新
    const mid = s.xySellNext!;
    const r1 = tickXianyu(s, () => 0.3, mid);
    expect(r1.sold).toHaveLength(1);
    expect(r1.refreshed).toBe(false);
    expect(s.xySellNext).toBe(mid + XY_SELL_MS);
    // 5 分钟到点：只刷新货源
    const r2 = tickXianyu(s, lcg(5), s.xyNext);
    expect(r2.refreshed).toBe(true);
    expect(r2.sold).toHaveLength(0);
  });

  it('已精通桌游不再刷出', () => {
    const s = defaultState();
    own(s, 'guoyuan', { prof: 20 }); // N 精通
    const r = refreshXianyu(s, false, lcg(99), 0);
    expect(r.items!.every(i => i.gameId !== 'guoyuan')).toBe(true);
  });

  it('常规款全部精通、隐藏款未收集：刷新只出隐藏款且不抛错（含盲买）', () => {
    const s = defaultState();
    for (const g of REGULAR_GAMES) s.collections[g.id] = { firstOpened: true, prof: 99999, fatigue: 0, rulesRead: false };
    const hiddenIds = GAMES.filter(g => g.hidden).map(g => g.id);
    s.money = 1e6;
    for (const seed of [1, 7, 42, 99, 12345]) {
      const r = refreshXianyu(s, true, lcg(seed), 0);
      expect(r.ok).toBe(true);
      expect(r.items!.length).toBeGreaterThan(0);
      expect(r.items!.every(i => hiddenIds.includes(i.gameId))).toBe(true);
    }
    expect(s.money).toBe(1e6 - 5 * 20);
  });

  it('全部桌游精通：付费刷新直接拒绝且不扣钱', () => {
    const s = defaultState();
    for (const g of GAMES) s.collections[g.id] = { firstOpened: true, prof: 99999, fatigue: 0, rulesRead: false };
    s.money = 100;
    const r = refreshXianyu(s, true, lcg(1), 0);
    expect(r.ok).toBe(false);
    expect(s.money).toBe(100); // 空池不扣钱
  });
});

describe('某赏（常驻池 + 轮换池）', () => {
  it('奖池表命中区间：0.2→4包 / 0.4→10包 / 0.48→20包 / 0.7→N / 0.9→R / 0.97→SR / 0.995→SSR', () => {
    expect(rollGachaOutcome(() => 0.2, false)).toEqual({ kind: 'sleeves', packs: 4 });
    expect(rollGachaOutcome(() => 0.4, false)).toEqual({ kind: 'sleeves', packs: 10 });
    expect(rollGachaOutcome(() => 0.48, false)).toEqual({ kind: 'sleeves', packs: 20 });
    expect(rollGachaOutcome(() => 0.7, false)).toEqual({ kind: 'game', rarity: 'N' });
    expect(rollGachaOutcome(() => 0.9, false)).toEqual({ kind: 'game', rarity: 'R' });
    expect(rollGachaOutcome(() => 0.97, false)).toEqual({ kind: 'game', rarity: 'SR' });
    expect(rollGachaOutcome(() => 0.995, false)).toEqual({ kind: 'game', rarity: 'SSR' });
    // 保底：按 3:1 在 SR/SSR 间掷
    expect(rollGachaOutcome(() => 0.1, true)).toEqual({ kind: 'game', rarity: 'SSR' });
    expect(rollGachaOutcome(() => 0.5, true)).toEqual({ kind: 'game', rarity: 'SR' });
  });

  it('常驻池：普通券抽取不扣钱；牌套结果入账且保底 +1', () => {
    const s = defaultState();
    s.tickets = 1;
    const r = gachaDraw(s, 'perm', 'ticket', () => 0); // → 4 包牌套
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.kind).toBe('sleeves');
    if (r.kind !== 'sleeves') return;
    expect(r.packs).toBe(4);
    expect(r.sleeves).toBe(200);
    expect(s.sleeves).toBe(300); // 初始 100 + 200
    expect(s.tickets).toBe(0);
    expect(s.money).toBe(200);
    expect(s.stats.pulls).toBe(1);
    expect(s.pity).toBe(1); // 牌套结果也计保底
  });

  it('保底：常驻 49 后必出 SR 及以上并清零；轮换池独立计数 pityRot', () => {
    const s = defaultState();
    s.pity = 49;
    s.money = 1e9;
    const r = gachaDraw(s, 'perm', 'money', () => 0.1); // forcePity → SSR（<0.25）
    if ('error' in r || r.kind !== 'game') throw new Error('unexpected');
    expect(r.rarity).toBe('SSR');
    expect(s.pity).toBe(0);
    expect(s.pityRot).toBe(0); // 轮换池计数未动
  });

  it('自然抽出 SR 也重置保底', () => {
    const s = defaultState();
    s.pity = 10;
    s.money = 1e9;
    const r = gachaDraw(s, 'perm', 'money', () => 0.97); // → SR
    if ('error' in r || r.kind !== 'game') throw new Error('unexpected');
    expect(r.rarity).toBe('SR');
    expect(s.pity).toBe(0);
  });

  it('重复 = 直接获得新实体（不再赠牌套）', () => {
    const s = defaultState();
    for (const id of ['lingji', 'aoding', 'fangzhou', 'guizhen']) own(s, id);
    s.pity = 49;
    const r = gachaDraw(s, 'perm', 'money', () => 0.1); // 保底 → SSR
    if ('error' in r || r.kind !== 'game') throw new Error('unexpected');
    expect(r.rarity).toBe('SSR');
    expect(r.duplicate).toBe(true);
    expect(s.copies.length).toBe(5); // 4 + 新增 1
    expect(s.sleeves).toBe(100); // 牌套不变
  });

  it('桌游池：仅出桌游（N60/R30/SR8/SSR2）；高级券抽取；独立保底', () => {
    const s = defaultState();
    s.rotTheme = '演算';
    s.hiTickets = 1;
    expect(rotatingPool('演算').every(g => g.attrs.includes('演算'))).toBe(true);
    const r = gachaDraw(s, 'rot', 'hiTicket', () => 0.7); // 0.7 → R 档
    if ('error' in r || r.kind !== 'game') throw new Error('unexpected');
    expect(r.rarity).toBe('R');
    // R × 演算 = 欢迎来到月球 / 奋进号：深海 / 大搜查系列
    expect(['yueliang', 'fende', 'dasoucha']).toContain(r.gameId);
    expect(s.hiTickets).toBe(0);
    expect(s.pityRot).toBe(1); // R 不计 SR+，保底 +1
    expect(s.pity).toBe(0);
    // 不出牌套：各区间 rng 均为桌游结果（桌游池单抽 ¥200）
    s.money = 1e9;
    for (const v of [0.1, 0.5, 0.65, 0.95, 0.99]) {
      const r2 = gachaDraw(s, 'rot', 'money', () => v);
      if ('error' in r2) throw new Error('unexpected');
      expect(r2.kind).toBe('game');
    }
  });

  it('桌游池概率边界：0.5→N / 0.7→R / 0.95→SR / 0.99→SSR；保底 3:1', () => {
    expect(rollGameRarity(() => 0.5, false)).toBe('N');
    expect(rollGameRarity(() => 0.7, false)).toBe('R');
    expect(rollGameRarity(() => 0.95, false)).toBe('SR');
    expect(rollGameRarity(() => 0.99, false)).toBe('SSR');
    expect(rollGameRarity(() => 0.1, true)).toBe('SSR');
    expect(rollGameRarity(() => 0.5, true)).toBe('SR');
  });

  it('轮换池保底必出 SR 及以上且限定主题内', () => {
    const s = defaultState();
    s.rotTheme = '演算';
    s.pityRot = 49;
    s.money = 1e9;
    const r = gachaDraw(s, 'rot', 'money', () => 0.1); // forcePity → SSR
    if ('error' in r || r.kind !== 'game') throw new Error('unexpected');
    expect(r.rarity).toBe('SSR');
    expect(['aoding', 'fangzhou']).toContain(r.gameId); // 带演算的 SSR
    expect(s.pityRot).toBe(0);
  });

  it('精通池：牌套支付、只加熟练值；稀有度全精通回退 +100 牌套；全精通拒绝', () => {
    const s = defaultState();
    // 只拥有 N 款（guoyuan 熟练 18），其余未入手
    own(s, 'guoyuan', { prof: 18 });
    s.sleeves = 500;
    // 0.5 → N 档：guoyuan 熟练 18+5=23（允许溢出），并标记本次精通
    const r = gachaDraw(s, 'master', 'sleeves', () => 0.5);
    if ('error' in r || r.kind !== 'prof') throw new Error('unexpected');
    expect(r.gameId).toBe('guoyuan');
    expect(r.prof).toBe(5);
    expect(r.masteredNow).toBe(true);
    expect(s.collections['guoyuan'].prof).toBe(23);
    expect(s.sleeves).toBe(300); // 500 - 200
    expect(s.stats.pulls).toBe(1);
    // guoyuan 已精通 → 精通池只剩空集 → 拒绝且不扣牌套
    const r2 = gachaDraw(s, 'master', 'sleeves', () => 0.5);
    expect('error' in r2).toBe(true);
    expect(s.sleeves).toBe(300);
    // 0.7 → R 档：未拥有任何 R 款 → 回退 +100 牌套
    const s2 = defaultState();
    own(s2, 'guoyuan');
    s2.sleeves = 300;
    const r3 = gachaDraw(s2, 'master', 'sleeves', () => 0.7);
    if ('error' in r3 || r3.kind !== 'sleeves') throw new Error('unexpected');
    expect(r3.sleeves).toBe(100);
    expect(s2.sleeves).toBe(200); // 300 - 200 + 100
    expect(s2.collections['guoyuan'].prof).toBe(0); // 熟练值不变
    // 未入手的桌游不在奖池：只有 boendi（N）时抽 N 档必中 boendi
    const s3 = defaultState();
    own(s3, 'boendi');
    s3.sleeves = 200;
    const r4 = gachaDraw(s3, 'master', 'sleeves', () => 0.1); // 0.1 → N
    if ('error' in r4 || r4.kind !== 'prof') throw new Error('unexpected');
    expect(r4.gameId).toBe('boendi');
    expect(s3.collections['boendi'].prof).toBe(5);
  });

  it('高级券兑换：批量，普通券+牌套不足时拒绝', () => {
    const s = defaultState();
    s.tickets = 3;
    s.sleeves = 120; // 只够 2 张
    expect(exchangeHiTickets(s, 3).ok).toBe(false);
    expect(exchangeHiTickets(s, 2).ok).toBe(true);
    expect(s.tickets).toBe(1);
    expect(s.sleeves).toBe(120 - 2 * HI_TICKET_SLEEVES);
    expect(s.hiTickets).toBe(2);
    expect(exchangeHiTickets(s, 0).ok).toBe(false);
  });

  it('tickRotation：首次开池，之后每 10 分钟换主题', () => {
    const s = defaultState();
    const r1 = tickRotation(s, lcg(7), 0);
    expect(r1.changed).toBe(true);
    expect(s.rotTheme).not.toBeNull();
    expect(s.rotNext).toBe(ROTATION_MS);
    const r2 = tickRotation(s, lcg(7), ROTATION_MS - 1);
    expect(r2.changed).toBe(false);
    const r3 = tickRotation(s, () => 0, ROTATION_MS);
    expect(r3.changed).toBe(true);
    expect(s.rotTheme).toBe('谋略'); // rng 0 → 第一个属性
  });
});

describe('tick 与离线（工作周期制）', () => {
  it('tickSecond：周期未满只推进不结算；满周期一次性发酬劳，余量入下周期', () => {
    const s = defaultState();
    expect(tickSecond(s, () => 0.5).payout).toBe(0); // 无职业
    takeJob(s, 'teacher'); // 160 秒/周期，¥100
    for (let i = 0; i < 159; i++) tickSecond(s, () => 0.5);
    expect(s.money).toBe(200);
    expect(s.jobProgress).toBe(159);
    const r = tickSecond(s, () => 0.5); // 第 160 秒结算
    expect(r.payout).toBe(1);
    expect(r.payAmount).toBe(100);
    expect(r.ticketDrop).toBe(false);
    expect(r.streamEvent).toBeNull();
    expect(s.money).toBe(300);
    expect(s.jobProgress).toBe(0);
  });

  it('换工作/辞职清零周期进度', () => {
    const s = defaultState();
    takeJob(s, 'teacher');
    for (let i = 0; i < 100; i++) tickSecond(s, () => 0.5);
    expect(s.jobProgress).toBe(100);
    takeJob(s, 'calc');
    expect(s.jobProgress).toBe(0);
    for (let i = 0; i < 30; i++) tickSecond(s, () => 0.5);
    quitJob(s);
    expect(s.jobProgress).toBe(0);
  });

  it('主播：周期结算时按应变下限~1.5 波动', () => {
    const s = defaultState();
    takeJob(s, 'streamer'); // 200 秒/周期，¥200 波动（应变 0 级：0.5~1.5）
    for (let i = 0; i < 199; i++) tickSecond(s, () => 0.5);
    const r = tickSecond(s, () => 0.5); // 波动 0.5 + 0.5×1.0 = 1.0 → ¥200
    expect(r.payout).toBe(1);
    expect(r.payAmount).toBe(200);
    expect(r.streamEvent).toBeNull(); // rng 0.5 ≥ 0.3 不触发
    // 应变 4 级：收入 ×1.16，下限 0.7，rng=1 → 波动 1.5 → ¥200×1.16×1.5=348
    s.attrExp['应变'] = 4 * 300; // 直接塞经验（不必精确到级曲线）
    for (let i = 0; i < 200; i++) tickSecond(s, () => 1);
    // 结算一次即可验证上限
    expect(s.money).toBe(200 + 200 + 348);
  });

  it('离线累积：工作按整周期折算直接入账；上限 1 小时', () => {
    const s = defaultState();
    takeJob(s, 'teacher'); // 160s/¥100
    accumulateOffline(s, 30 * 60 * 1000); // 1800 秒 → 11 周期 + 余 40 秒
    expect(s.offlineBank.t).toBe(1800 * 1000);
    expect(s.offlineBank.workMoney).toBeCloseTo(11 * 100 * 0.5, 6); // ¥550
    expect(s.offlineBank.workCycles).toBe(11);
    expect(s.money).toBe(200 + 550); // 直接入账，无需领取
    expect(s.jobProgress).toBe(40);
    accumulateOffline(s, 2 * 3600 * 1000); // 再来 2 小时，封顶（再计 1800 秒 → 11 周期余 80）
    expect(s.offlineBank.t).toBe(3600 * 1000);
    expect(s.offlineBank.workMoney).toBeCloseTo(22 * 100 * 0.5, 6); // ¥1100
    expect(s.jobProgress).toBe(80);
    accumulateOffline(s, 60000); // 已满，不再累积
    expect(s.offlineBank.t).toBe(3600 * 1000);
  });

  it('离线自动游玩：真实扣疲劳/耐久，战报记录局数/经验', () => {
    const s = defaultState();
    const c = own(s, 'guoyuan'); // 单实体，单回合 ≈ 42.6s
    const moneyBefore = s.money;
    accumulateOffline(s, 10 * 60 * 1000, lcg(3)); // 600 秒
    const b = s.offlineBank;
    expect(b.playRounds).toBeGreaterThan(5);
    expect(s.money).toBe(moneyBefore); // 游玩不产生金钱
    expect(s.collections['guoyuan'].prof).toBe(b.playRounds);
    expect(c.durability).toBeLessThan(DURABILITY.N);
    const row = b.games.find(g => g.gameId === 'guoyuan')!;
    expect(row.rounds).toBe(b.playRounds);
    expect(row.wear).toBeCloseTo(DURABILITY.N - c.durability, 6);
    expect(b.exp['演算']).toBeGreaterThan(0);
    // 疲劳真实增长（目标收藏每局 +2，封顶 20）
    expect(s.collections['guoyuan'].fatigue).toBe(Math.min(20, 2 * b.playRounds));
    // 上架中的实体不参与离线游玩
    const s2 = defaultState();
    own(s2, 'guoyuan');
    listCopy(s2, s2.copies[0].uid, 0.5);
    accumulateOffline(s2, 10 * 60 * 1000, lcg(3));
    expect(s2.offlineBank.playRounds).toBe(0);
  });

  it('离线自动更换（玩腻了换）：疲劳≥7 的收藏被跳过，全疲劳时退回贪心', () => {
    // boendi baseExp 27 但疲劳 8（玩腻了）；guoyuan baseExp 13 无疲劳
    const s = defaultState();
    own(s, 'boendi', { fatigue: 8 });
    own(s, 'guoyuan');
    s.settings.autoSwitch = 'fatigue';
    accumulateOffline(s, 10 * 60 * 1000, lcg(3));
    expect(s.offlineBank.playRounds).toBeGreaterThan(0);
    // guoyuan 一直玩到自己也腻了（疲劳≥7）才退回贪心换 boendi
    expect(s.offlineBank.games.map(g => g.gameId)).toEqual(['guoyuan', 'boendi']);
    expect(s.collections['guoyuan'].fatigue).toBeGreaterThanOrEqual(7);
    // 全部候选都玩腻了 → 退回按收益贪心（其他收藏每局 -1 疲劳，会交替出现）
    const s2 = defaultState();
    own(s2, 'boendi', { fatigue: 8 });
    own(s2, 'guoyuan', { fatigue: 8 });
    s2.settings.autoSwitch = 'fatigue';
    accumulateOffline(s2, 10 * 60 * 1000, lcg(3));
    expect(s2.offlineBank.playRounds).toBeGreaterThan(0);
  });

  it('离线自动更换（玩腻了换）：粘性目标——未玩腻期间不碰高价值已腻款', () => {
    // boendi/xueyuan 基础经验高但已玩腻；guoyuan 未腻。粘性盯着 guoyuan 玩到腻（4 局，疲劳 0→8）为止，
    // 期间已腻的高价值款一局都不该出现（旧实现每轮贪心重选，已腻款会反复蹭局）
    const s = defaultState();
    own(s, 'boendi', { fatigue: 9 });
    own(s, 'xueyuan', { fatigue: 9 });
    own(s, 'guoyuan');
    s.settings.autoSwitch = 'fatigue';
    accumulateOffline(s, 100 * 1000, lcg(3)); // 恰好 3 局，guoyuan 疲劳到 6 尚未腻
    expect(s.offlineBank.playRounds).toBe(3);
    expect(s.offlineBank.games.map(g => g.gameId)).toEqual(['guoyuan']);
    expect(s.collections['guoyuan'].fatigue).toBeLessThan(7);
  });

  it('离线自动更换（精通后换）：已精通收藏被跳过', () => {
    // boendi 熟练 25（N 需求 20，已精通）；guoyuan 熟练 0
    const s = defaultState();
    own(s, 'boendi', { prof: 25 });
    own(s, 'guoyuan');
    s.settings.autoSwitch = 'mastery';
    accumulateOffline(s, 10 * 60 * 1000, lcg(3));
    expect(s.offlineBank.playRounds).toBeGreaterThan(0);
    // guoyuan 精通后已无任何未精通候选（boendi 也已精通）→ 与在线一致：维持当前继续玩
    expect(s.offlineBank.games.map(g => g.gameId)).toEqual(['guoyuan']);
    expect(s.collections['guoyuan'].prof).toBe(s.offlineBank.playRounds);
    // 开局就已全部精通 → 退回贪心挑最高收益款（boendi 基础经验更高）
    const s2 = defaultState();
    own(s2, 'boendi', { prof: 25 });
    own(s2, 'guoyuan', { prof: 25 });
    s2.settings.autoSwitch = 'mastery';
    accumulateOffline(s2, 10 * 60 * 1000, lcg(3));
    expect(s2.offlineBank.playRounds).toBeGreaterThan(0);
    expect(s2.offlineBank.games.map(g => g.gameId)).toEqual(['boendi']);
  });
});

describe('游玩结算（含磨损与 0 耐久惩罚）', () => {
  it('基础结算：疲劳 ±（收藏级）、熟练度、磨损 -1（实体级）', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan'); // 单属性 演算 13
    own(s, 'boendi', { fatigue: 5 });
    // 原型语义：先加疲劳（0→2）再结算，且吃 2 种图鉴加成 1.03
    const r = settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99); // 不掉券
    expect(r.gains['演算']).toBeCloseTo((13 / 1.3) * 1.03, 10);
    expect(s.collections['guoyuan'].fatigue).toBe(2);
    expect(s.collections['guoyuan'].prof).toBe(1);
    expect(s.collections['guoyuan'].rulesRead).toBe(true);
    expect(s.collections['boendi'].fatigue).toBe(4); // 5-1
    expect(copy.durability).toBe(DURABILITY.N - 1); // 磨损 1
    expect(r.wear).toBe(1);
    expect(r.worn).toBe(false);
    expect(s.stats.plays).toBe(1);
  });

  it('疲劳 float 累计：沉浸按百分比平滑生效（1 级 → +1.92，不取整）', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan');
    s.attrExp['沉浸'] = 60; // 1 级：疲劳增长 ×0.96
    settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99);
    expect(s.collections['guoyuan'].fatigue).toBeCloseTo(1.92, 10);
    settleRound(s, 'guoyuan', copy.uid, 2, () => 0.99);
    expect(s.collections['guoyuan'].fatigue).toBeCloseTo(3.84, 10);
    // 疲劳收益按 float 计算：第 3 局先加疲劳（3.84+1.92=5.76）再结算，无档位钝化
    const expBase = 13 * expMult(s) / (1 + 5.76 * 0.15);
    const r = settleRound(s, 'guoyuan', copy.uid, 3, () => 0.99);
    expect(r.gains['演算']).toBeCloseTo(expBase, 6);
    expect(s.collections['guoyuan'].fatigue).toBeCloseTo(5.76, 10);
  });

  it('磨损公式：收纳 ×0.75、牌套 ×0.5（收藏级与实体级分离）', () => {
    const s = defaultState();
    const stored = own(s, 'xueyuan', { stored: true }); // 血源 N 级大盒
    const r = settleRound(s, 'xueyuan', stored.uid, 1, () => 0.99);
    expect(r.wear).toBe(0.75);
    expect(stored.durability).toBeCloseTo(DURABILITY.N - 0.75);

    const s2 = defaultState();
    const sleeved = own(s2, 'guoyuan', { sleeved: true });
    const r2 = settleRound(s2, 'guoyuan', sleeved.uid, 1, () => 0.99);
    expect(r2.wear).toBe(0.5);
    expect(sleeved.durability).toBe(DURABILITY.N - 0.5);
  });

  it('0 耐久：可玩但经验 ×0.5；磨损不再扣（已归零）', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan', { durability: 0 });
    const r = settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99);
    expect(r.worn).toBe(true);
    // 先加疲劳（0→2，÷1.3）× 0耐久惩罚 0.5 × 自身图鉴 1.015
    expect(r.gains['演算']).toBeCloseTo((13 / 1.3) * 0.5 * 1.015, 6);
    expect(copy.durability).toBe(0);
  });

  it('20强词条：疲劳增长减半（+2 → +1）', () => {
    const s = defaultState();
    own(s, 'guoyuan');
    own(s, 'ershiqiang');
    const uid = uidOf(s, 'guoyuan');
    settleRound(s, 'guoyuan', uid, 1, () => 0.99);
    expect(s.collections['guoyuan'].fatigue).toBe(1);
  });

  it('多属性桌游经验按份额分摊（勃艮第 65/35）', () => {
    const s = defaultState();
    const copy = own(s, 'boendi');
    settleRound(s, 'boendi', copy.uid, 1, () => 0.99);
    // 疲劳 0→2（÷1.3）× 自身图鉴 1.015
    expect(s.attrExp['谋略']).toBeCloseTo(27 * 0.65 * (1 / 1.3) * 1.015, 6);
    expect(s.attrExp['应变']).toBeCloseTo(27 * 0.35 * (1 / 1.3) * 1.015, 6);
  });

  it('上架中的实体不可游玩；未拥有不可结算', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan');
    listCopy(s, copy.uid, 1);
    expect(() => settleRound(s, 'guoyuan', copy.uid, 1, () => 0.5)).toThrow('上架');
    expect(() => settleRound(s, 'kafei', 999, 1, () => 0.5)).toThrow();
  });

  it('掉券：洞察 1 级 + 黑色奏鸣曲 → 0.06×1.2×1.25=0.09，rng 0 必掉', () => {
    const s = defaultState();
    const copy = own(s, 'guoyuan');
    s.attrExp['洞察'] = 60;
    own(s, 'hezou');
    const r = settleRound(s, 'guoyuan', copy.uid, 1, () => 0);
    expect(r.ticketDrop).toBe(true);
    expect(s.tickets).toBe(1);
  });
});
