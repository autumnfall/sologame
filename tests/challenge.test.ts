import { describe, expect, it, vi } from 'vitest';
import {
  CHALLENGES, DURABILITY, GACHA_PRICE, GAMES, REGULAR_GAMES, SAVE_VERSION, XY_REFRESH_MS,
  abandonChallenge, accumulateOffline, buyChallengeShop, buyTaobao, buyXianyu,
  challengeAvailable, challengeShopLv, checkChallenge, defaultState, distinctCopyKinds,
  doPrestige, expMult, gachaDraw, gachaMoneyPrice, goalProgress, kindCount, listCopy,
  parseSave, refreshXianyu, sellChance, sellChanceFinal, serialize, settleRound,
  startChallenge, takeJob, tickSecond, tickXianyu,
} from '../src/core';
import type { GameState } from '../src/core';
import { lcg, own } from './helpers';

/** 构造一个已完成指定挑战、可激活 id 的状态 */
function stateWithChallenge(done: string[], active?: string): GameState {
  const s = defaultState();
  s.prestige.challengeDone = [...done];
  if (active) {
    const r = startChallenge(s, active);
    if (!r.ok) throw new Error(`激活失败: ${r.reason}`);
  }
  return s;
}

const FIVE_N = ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska'];

describe('挑战：激活与放弃', () => {
  it('第一层开局即可激活；同时只能激活一个；完成后不可再激活（一次性）', () => {
    const s = defaultState();
    expect(challengeAvailable(s, 'no-salary')).toBe(true);
    expect(startChallenge(s, 'no-salary').ok).toBe(true);
    expect(s.challenge.active).toBe('no-salary');
    expect(startChallenge(s, 'marathon').ok).toBe(false); // 已有激活
    expect(abandonChallenge(s).ok).toBe(true);
    expect(s.challenge.active).toBeNull();
    expect(startChallenge(s, 'marathon').ok).toBe(true);
    // 领过奖励后拒绝再激活
    s.prestige.challengeDone.push('no-salary');
    expect(startChallenge(s, 'no-salary').ok).toBe(false);
  });

  it('前置：big-earner 需 flea-market 与 merchant 都完成；startChallenge 同步校验', () => {
    const s = defaultState();
    expect(challengeAvailable(s, 'big-earner')).toBe(false);
    expect(startChallenge(s, 'big-earner').ok).toBe(false);
    s.prestige.challengeDone.push('flea-market');
    expect(challengeAvailable(s, 'big-earner')).toBe(false);
    s.prestige.challengeDone.push('merchant');
    expect(challengeAvailable(s, 'big-earner')).toBe(true);
    expect(startChallenge(s, 'big-earner').ok).toBe(true);
  });

  it('花佬 startMoneyBonus：激活立得 ¥1000，放弃不退回、可重新激活', () => {
    const s = stateWithChallenge(['hardcore']);
    s.money = 200;
    expect(startChallenge(s, 'collector').ok).toBe(true);
    expect(s.money).toBe(1200);
    expect(abandonChallenge(s).ok).toBe(true);
    expect(s.money).toBe(1200); // 不退回
    expect(startChallenge(s, 'collector').ok).toBe(true); // 未完成可重新激活
  });
});

describe('挑战：条件修饰', () => {
  it('无薪挑战：在线 tick 不发薪（周期照走、周期数照计）', () => {
    const s = stateWithChallenge([], 'no-salary');
    takeJob(s, 'teacher'); // 160 秒/周期，¥100
    for (let i = 0; i < 160; i++) {
      const r = tickSecond(s, () => 0.5);
      if (r.payout) {
        expect(r.payAmount).toBe(0);
      }
    }
    expect(s.money).toBe(200);
    expect(s.jobProgress).toBe(0);
    expect(s.stats.workCycles).toBe(1);
  });

  it('无薪挑战：离线结算同样不发薪（周期照走）', () => {
    const s = stateWithChallenge([], 'no-salary');
    takeJob(s, 'teacher');
    accumulateOffline(s, 30 * 60 * 1000); // 1800 秒 → 11 周期余 40
    expect(s.offlineBank.workMoney).toBe(0);
    expect(s.money).toBe(200);
    expect(s.offlineBank.workCycles).toBe(11);
    expect(s.jobProgress).toBe(40);
  });

  it('捡漏之王：刷新间隔 ×0.5、到货件数 ×2（(3+1)×2=8 件，其中 1 件一口价）', () => {
    const s = stateWithChallenge(['no-salary'], 'flea-market');
    const now = 1_000_000;
    const r = refreshXianyu(s, false, lcg(42), now);
    expect(r.ok).toBe(true);
    expect(s.xyNext).toBe(now + XY_REFRESH_MS * 0.5);
    expect(s.xianyuBuys).toHaveLength(8);
    expect(s.xianyuBuys.filter(i => i.blind)).toHaveLength(1);
    // 无挑战时基线为 marketSlots + 1 = 4 件
    const s2 = defaultState();
    refreshXianyu(s2, false, lcg(42), now);
    expect(s2.xianyuBuys).toHaveLength(4);
  });

  it('壮壮：到货件数 ×0.5（round(4×0.5)=2 件，其中 1 件一口价）', () => {
    const s = stateWithChallenge(['no-salary'], 'merchant');
    const r = refreshXianyu(s, false, lcg(42), 0);
    expect(r.ok).toBe(true);
    expect(s.xianyuBuys).toHaveLength(2);
    expect(s.xianyuBuys.filter(i => i.blind)).toHaveLength(1);
  });

  it('硬核玩家：经验 ×0.6（settleRound 断言）', () => {
    const s = stateWithChallenge(['marathon'], 'hardcore');
    const copy = own(s, 'guoyuan'); // 单属性 演算 13
    const r = settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99);
    // 疲劳 0→2（÷1.3）× 图鉴 1.015 × 挑战 0.6
    expect(r.gains['演算']).toBeCloseTo((13 / 1.3) * 1.015 * 0.6, 10);
    const s2 = defaultState();
    const copy2 = own(s2, 'guoyuan');
    settleRound(s2, 'guoyuan', copy2.uid, 1, () => 0.99);
    expect(r.gains['演算']).toBeCloseTo(s2.attrExp['演算'] * 0.6, 10);
  });

  it('肝帝：疲劳增长 ×1.5（+2 → +3）', () => {
    const s = stateWithChallenge([], 'marathon');
    const copy = own(s, 'guoyuan');
    settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99);
    expect(s.collections['guoyuan'].fatigue).toBeCloseTo(3, 10);
  });

  it('柠檬佬：某赏价格 ×1.5（常驻池 + 桌游池），钱不够拒绝不扣费', () => {
    const s = stateWithChallenge(['hardcore'], 'whale');
    expect(gachaMoneyPrice(s, 'perm')).toBe(Math.max(1, Math.round(GACHA_PRICE * 1.5)));
    s.money = gachaMoneyPrice(s, 'perm') - 1;
    const r = gachaDraw(s, 'perm', 'money', () => 0.2);
    expect('error' in r).toBe(true);
    expect(s.money).toBe(gachaMoneyPrice(s, 'perm') - 1);
    expect(s.stats.pulls).toBe(0);
    s.money = 1e9;
    const r2 = gachaDraw(s, 'perm', 'money', () => 0.2); // 4 包牌套
    expect('error' in r2).toBe(false);
    expect(s.money).toBe(1e9 - gachaMoneyPrice(s, 'perm'));
    expect(s.stats.pulls).toBe(1);
    // 无挑战时价格还原
    const s2 = defaultState();
    expect(gachaMoneyPrice(s2, 'perm')).toBe(GACHA_PRICE);
  });

  it('叉叉：成交率 ×1.2（与好口碑乘区并列）', () => {
    const plain = defaultState();
    const s = stateWithChallenge(['flea-market', 'merchant'], 'big-earner');
    const base = sellChance(2.0, DURABILITY.N, 'N');
    expect(sellChanceFinal(plain, 2.0, DURABILITY.N, 'N')).toBeCloseTo(base, 10);
    expect(sellChanceFinal(s, 2.0, DURABILITY.N, 'N')).toBeCloseTo(base * 1.2, 10);
  });
});

describe('挑战：目标与达成', () => {
  it('xyEarn 目标：成交通道累计净额，达成发币 + challengeDone + active 清空', () => {
    const s = stateWithChallenge([], 'no-salary');
    const c = own(s, 'guoyuan');
    listCopy(s, c.uid, 0.5);
    s.xySellNext = 1;
    const r = tickXianyu(s, () => 0, 100); // 全新×50% 必卖
    expect(r.sold).toHaveLength(1);
    expect(s.stats.xyEarned).toBe(r.sold[0].gain); // 净额 = 成交价 − 手续费
    expect(checkChallenge(s)).toHaveLength(0); // 未达标
    expect(goalProgress(s)).toBe(s.stats.xyEarned);
    s.stats.xyEarned = 2000; // 直接补足净额
    const events = checkChallenge(s);
    expect(events).toHaveLength(1);
    expect(events[0].def.id).toBe('no-salary');
    expect(events[0].reward).toBe(2);
    expect(s.prestige.coins).toBe(2);
    expect(s.prestige.challengeDone).toEqual(['no-salary']);
    expect(s.challenge.active).toBeNull();
    expect(s.challenge.progress).toBe(0);
    // 一次性：再激活被拒
    expect(startChallenge(s, 'no-salary').ok).toBe(false);
  });

  it('花佬：禁止游玩——离线自动游玩跳过（连刷 0 局）', () => {
    const s = stateWithChallenge(['hardcore'], 'collector');
    own(s, 'guoyuan');
    accumulateOffline(s, 10 * 60 * 1000, lcg(3));
    expect(s.offlineBank.playRounds).toBe(0);
    expect(s.collections['guoyuan'].prof).toBe(0);
  });

  it('花佬：架上 30 款不同实体时 distinctCopies 达成', () => {
    const s = stateWithChallenge(['hardcore'], 'collector');
    const ids = REGULAR_GAMES.slice(0, 30).map(g => g.id);
    for (const id of ids) own(s, id);
    expect(goalProgress(s)).toBe(30);
    const events = checkChallenge(s);
    expect(events).toHaveLength(1);
    expect(s.prestige.coins).toBe(4);
    expect(s.prestige.challengeDone).toContain('collector');
  });

  it('花佬：在线 beginRound 入口被拒（store 层拦截）', async () => {
    const { createPinia, setActivePinia } = await import('pinia');
    const { useGameStore } = await import('../src/ui/stores/game');
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout,
      confirm: () => true,
    });
    setActivePinia(createPinia());
    const store = useGameStore();
    store.s = stateWithChallenge(['hardcore'], 'collector');
    own(store.s, 'guoyuan');
    store.requestPlay('guoyuan');
    expect(store.session).toBeNull(); // 被拒：不可游玩
    expect(store.toastMsg).toContain('不可游玩');
    // 无挑战限制时可正常开局
    store.s.challenge.active = null;
    store.requestPlay('guoyuan');
    expect(store.session).not.toBeNull();
    store.clearSession();
    vi.unstubAllGlobals();
  });

  it('叉叉：款数上限拦截新款购入（某宝/某鱼/某赏），已有款加购放行且不扣款', () => {
    const s = stateWithChallenge(['flea-market', 'merchant'], 'big-earner');
    for (const id of FIVE_N) own(s, id); // 架上 5 款
    s.money = 1e9;
    // 某宝：新款被拒，钱与库存不动
    expect(buyTaobao(s, 'shikong').ok).toBe(false);
    expect(s.money).toBe(1e9);
    expect(s.taobaoStock['shikong']).toBeUndefined();
    // 某宝：已有款加购副本放行
    expect(buyTaobao(s, 'guoyuan').ok).toBe(true);
    expect(s.copies.filter(c => c.gameId === 'guoyuan')).toHaveLength(2);
    // 某鱼：新款货源被拒
    s.money = 1e9;
    s.xianyuBuys = [{ gameId: 'shikong', price: 10, durability: 5, sleeved: false, stored: false }];
    const r = buyXianyu(s, 0);
    expect(r.ok).toBe(false);
    expect(s.money).toBe(1e9);
    expect(s.xianyuBuys).toHaveLength(1);
    // 某赏：抽出新款被拒（不扣费、不计抽数、不动保底）
    const s2 = stateWithChallenge(['flea-market', 'merchant'], 'big-earner');
    for (const id of FIVE_N) own(s2, id);
    s2.rotTheme = '演算';
    s2.money = 1e9;
    const vals = [0.7, 0]; // R 档 → candidates[0]
    const r2 = gachaDraw(s2, 'rot', 'money', () => vals.shift() ?? 0);
    expect('error' in r2 && r2.error).toContain('挑战限制');
    expect(s2.money).toBe(1e9);
    expect(s2.stats.pulls).toBe(0);
    expect(s2.pityRot).toBe(0);
  });

  it('叉叉：卖掉腾位后图鉴保留（distinctCollections 不回落），可再买新款', () => {
    const s = stateWithChallenge(['flea-market', 'merchant'], 'big-earner');
    for (const id of FIVE_N) own(s, id);
    s.money = 1e9;
    const c = s.copies.find(cp => cp.gameId === 'guoyuan')!;
    listCopy(s, c.uid, 0.5);
    s.xySellNext = 1;
    expect(tickXianyu(s, () => 0, 100).sold).toHaveLength(1);
    expect(distinctCopyKinds(s)).toBe(4);
    expect(kindCount(s)).toBe(5); // 图鉴卖光保留
    expect(goalProgress(s)).toBe(5);
    expect(buyTaobao(s, 'shikong').ok).toBe(true); // 腾位后可买新款
    expect(distinctCopyKinds(s)).toBe(5);
  });
});

describe('挑战商店', () => {
  it('购买扣币升级；after 前置未满足拒购；博览群玩乘区生效', () => {
    const s = defaultState();
    s.prestige.coins = 10;
    const before = expMult(s);
    expect(buyChallengeShop(s, 'xy-eye').ok).toBe(false); // 前置未满足
    expect(buyChallengeShop(s, 'exp-boost').ok).toBe(true);
    expect(s.prestige.coins).toBe(9);
    expect(challengeShopLv(s, 'expBoost')).toBe(1);
    expect(expMult(s)).toBeCloseTo(before * 1.05, 10);
    expect(buyChallengeShop(s, 'xy-eye').ok).toBe(true); // 前置满足后可买
    // 币不够拒购
    s.prestige.coins = 0;
    expect(buyChallengeShop(s, 'exp-boost').ok).toBe(false);
    expect(challengeShopLv(s, 'expBoost')).toBe(1);
  });

  it('火眼金睛：提高带牌套概率与成色下限（刷新货源透传）', () => {
    const s = defaultState();
    s.prestige.shop['exp-boost'] = 1; // 前置
    s.prestige.shop['xy-eye'] = 3;    // 满级：带牌套 25%→49%，成色下限 30%→75%
    refreshXianyu(s, false, lcg(11), 0);
    expect(s.xianyuBuys.length).toBeGreaterThan(0);
    for (const it of s.xianyuBuys) {
      const g = GAMES.find(r => r.id === it.gameId)!;
      const maxDur = DURABILITY[g.rarity];
      expect(it.durability).toBeGreaterThanOrEqual(Math.round(maxDur * 0.75)); // 成色下限上移
    }
    // 对照：无火眼金睛时成色下限 30%
    const s2 = defaultState();
    refreshXianyu(s2, false, lcg(11), 0);
    const low = s2.xianyuBuys.find(it => {
      const g = GAMES.find(r => r.id === it.gameId)!;
      return it.durability < Math.round(DURABILITY[g.rarity] * 0.75);
    });
    expect(low).toBeTruthy();
  });
});

describe('挑战与转生', () => {
  it('转生保留挑战币/商店/已完成挑战，重置进行中的挑战', () => {
    const s = stateWithChallenge(['flea-market', 'merchant'], 'big-earner');
    s.prestige.coins = 7;
    s.prestige.shop['exp-boost'] = 2;
    // 满足转生条件（8 款 N 精通）
    for (const g of REGULAR_GAMES.filter(x => x.rarity === 'N').slice(0, 8)) {
      own(s, g.id, { prof: 20 });
    }
    expect(doPrestige(s).ok).toBe(true);
    expect(s.prestige.coins).toBe(7);
    expect(s.prestige.shop).toEqual({ 'exp-boost': 2 });
    expect(s.prestige.challengeDone).toEqual(['flea-market', 'merchant']);
    expect(s.challenge).toEqual({ active: null, progress: 0 });
  });
});

describe('挑战：存档迁移（v12 → v13）', () => {
  it('v12 旧档 normalize 后新字段补默认值', () => {
    const s = defaultState();
    const old = JSON.parse(serialize(s)) as Record<string, unknown>;
    old.saveVersion = 12;
    delete old.challenge;
    old.prestige = { insight: 3, perks: {}, runs: 1, lastGain: 3 };
    old.stats = {
      plays: 1, pulls: 0, workCycles: 0, soldCount: 0, tbBought: 0, xyBought: 0,
      pityHits: 0, highPriceSold: 0, bargainBuys: 0, comeback: false, respecCount: 0,
    };
    const m = parseSave(JSON.stringify(old));
    expect(m).not.toBeNull();
    expect(m!.saveVersion).toBe(SAVE_VERSION);
    expect(m!.challenge).toEqual({ active: null, progress: 0 });
    expect(m!.prestige.coins).toBe(0);
    expect(m!.prestige.shop).toEqual({});
    expect(m!.prestige.challengeDone).toEqual([]);
    expect(m!.stats.xyEarned).toBe(0);
  });

  it('v13 档保留挑战进度与商店；未知挑战/商店 id 剔除', () => {
    const s = defaultState();
    s.challenge = { active: 'marathon', progress: 55 };
    s.prestige.coins = 5;
    s.prestige.shop = { 'exp-boost': 2 };
    s.prestige.challengeDone = ['no-salary'];
    s.stats.xyEarned = 42;
    const dirty = JSON.parse(serialize(s)) as Record<string, unknown>;
    (dirty.challenge as Record<string, unknown>).active = 'ghost';
    const pres = dirty.prestige as Record<string, unknown>;
    pres.challengeDone = ['no-salary', 'ghost'];
    pres.shop = { 'exp-boost': 1, ghost: 2 };
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    expect(m!.challenge).toEqual({ active: null, progress: 0 }); // 未知 id 视为无激活
    expect(m!.prestige.challengeDone).toEqual(['no-salary']);
    expect(m!.prestige.shop).toEqual({ 'exp-boost': 1 });
    expect(m!.prestige.coins).toBe(5);
    expect(m!.stats.xyEarned).toBe(42);
    // 合法挑战进度原样保留
    const good = JSON.parse(serialize(s)) as Record<string, unknown>;
    const m2 = parseSave(JSON.stringify(good));
    expect(m2!.challenge).toEqual({ active: 'marathon', progress: 55 });
    expect(CHALLENGES.length).toBe(8);
  });
});
