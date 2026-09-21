import { describe, expect, it, vi } from 'vitest';
import {
  CHALLENGES, DURABILITY, GACHA_PRICE, GAMES, REGULAR_GAMES, SAVE_VERSION, XY_REFRESH_MS,
  accumulateOffline, buyChallengeShop, buyTaobao, buyXianyu,
  challengeShopLv, checkChallenge, defaultState, distinctCopyKinds,
  doPrestige, expMult, gachaDraw, gachaMoneyPrice, goalProgress, kindCount, listCopy,
  parseSave, pickStarter, refreshXianyu, selectPendingChallenge, sellChance, sellChanceFinal, serialize,
  settleRound, takeJob, tickSecond, tickXianyu,
} from '../src/core';
import type { GameState } from '../src/core';
import { lcg, own } from './helpers';

/** 凑齐转生门槛（首周目精通 4 款 N；runs>0 时按 prestigeUnlockCount 递增，调用方传足款数） */
function meetUnlockRequirement(s: GameState, n = 4) {
  for (const g of REGULAR_GAMES.filter(x => x.rarity === 'N').slice(0, n)) {
    own(s, g.id, { prof: 20 }); // N 精通门槛 20 局
  }
}

/** 新流程开启带挑战的周目：登记已完成挑战 → 选择 pending → 转生（pending 消费为 active） */
function beginRunWithChallenge(done: string[], pending: string | null): GameState {
  const s = defaultState();
  s.prestige.challengeDone = [...done];
  meetUnlockRequirement(s);
  if (pending) {
    const r = selectPendingChallenge(s, pending);
    if (!r.ok) throw new Error(`选择挑战失败: ${r.reason}`);
  }
  expect(doPrestige(s).ok).toBe(true);
  return s;
}

const FIVE_N = ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska'];

describe('挑战：转生时选择、新周目生效', () => {
  it('selectPending 校验：已解锁且未完成的挑战才能选；已完成拒绝；null = 无挑战', () => {
    const s = defaultState();
    expect(selectPendingChallenge(s, 'big-earner').ok).toBe(false); // 前置未满足
    expect(s.prestige.pendingChallenge).toBeNull();
    expect(selectPendingChallenge(s, 'no-salary').ok).toBe(true);
    expect(s.prestige.pendingChallenge).toBe('no-salary');
    expect(s.challenge.active).toBeNull(); // 正常游玩期不生效
    expect(selectPendingChallenge(s, null).ok).toBe(true); // 改选无挑战
    expect(s.prestige.pendingChallenge).toBeNull();
    s.prestige.challengeDone.push('no-salary');
    expect(selectPendingChallenge(s, 'no-salary').ok).toBe(false); // 已完成（一次性）
  });

  it('selectPending 连续改选后者覆盖前者；未知 id 拒绝', () => {
    const s = defaultState();
    expect(selectPendingChallenge(s, 'marathon').ok).toBe(true);
    expect(selectPendingChallenge(s, 'no-salary').ok).toBe(true); // 改选
    expect(s.prestige.pendingChallenge).toBe('no-salary');
    expect(selectPendingChallenge(s, 'ghost').ok).toBe(false); // 未知挑战
    expect(s.prestige.pendingChallenge).toBe('no-salary'); // 拒绝时不覆盖
  });

  it('immediate：周目未开启窗口期直接生效（active 立置、pending 清空），下次转生不二次生效', () => {
    // 模拟弹窗窗口期：doPrestige 已跑（money 已重置为开局资金、started=false）
    const s = defaultState();
    s.money = 200;
    expect(s.challenge.active).toBeNull();
    const r = selectPendingChallenge(s, 'no-salary', true);
    expect(r.ok).toBe(true);
    expect(s.challenge.active).toBe('no-salary');
    expect(s.challenge.progress).toBe(0);
    expect(s.prestige.pendingChallenge).toBeNull(); // 立即生效不留 pending
    // 下一次转生：pending 已 null → 新周目无激活挑战（不二次生效）
    meetUnlockRequirement(s);
    expect(doPrestige(s).ok).toBe(true);
    expect(s.challenge.active).toBeNull();
    expect(s.prestige.pendingChallenge).toBeNull();
  });

  it('immediate：startMoneyBonus 入账（花佬 +¥1000）', () => {
    const s = defaultState();
    s.prestige.challengeDone.push('hardcore');
    s.money = 200;
    expect(selectPendingChallenge(s, 'collector', true).ok).toBe(true);
    expect(s.challenge.active).toBe('collector');
    expect(s.money).toBe(1200);
  });

  it('immediate 改选：旧挑战 bonus 精确回滚后应用新挑战（含替换 doPrestige 消费的）', () => {
    // 花佬（+1000）→ 改选无薪挑战（无 bonus）：money 回到基准
    const s = defaultState();
    s.prestige.challengeDone.push('hardcore');
    s.money = 200;
    expect(selectPendingChallenge(s, 'collector', true).ok).toBe(true);
    expect(s.money).toBe(1200);
    expect(selectPendingChallenge(s, 'no-salary', true).ok).toBe(true);
    expect(s.challenge.active).toBe('no-salary');
    expect(s.money).toBe(200); // 回滚 1000，无新 bonus
    // 窗口内替换 doPrestige 消费来的挑战：同样回滚其 bonus
    const s2 = beginRunWithChallenge(['hardcore'], 'collector'); // doPrestige 已发 +1000 → 1200
    expect(s2.challenge.active).toBe('collector');
    expect(selectPendingChallenge(s2, 'no-salary', true).ok).toBe(true);
    expect(s2.challenge.active).toBe('no-salary');
    expect(s2.money).toBe(200);
  });

  it('immediate 选「无挑战」：撤销本周目已生效挑战并回滚 bonus', () => {
    const s = defaultState();
    s.prestige.challengeDone.push('hardcore');
    s.money = 200;
    expect(selectPendingChallenge(s, 'collector', true).ok).toBe(true);
    expect(s.money).toBe(1200);
    expect(selectPendingChallenge(s, null, true).ok).toBe(true);
    expect(s.challenge.active).toBeNull();
    expect(s.money).toBe(200);
  });

  it('immediate 校验：已完成/未解锁拒绝且不污染 active', () => {
    const s = defaultState();
    s.prestige.challengeDone.push('no-salary');
    expect(selectPendingChallenge(s, 'no-salary', true).ok).toBe(false); // 已完成
    expect(selectPendingChallenge(s, 'big-earner', true).ok).toBe(false); // 未解锁
    expect(s.challenge.active).toBeNull();
    expect(s.prestige.pendingChallenge).toBeNull();
    expect(s.money).toBe(200);
  });

  it('doPrestige 消费 pending → active（progress 归零、pending 清空），只消费一次', () => {
    const s = defaultState();
    meetUnlockRequirement(s);
    expect(selectPendingChallenge(s, 'marathon').ok).toBe(true);
    const r = doPrestige(s);
    expect(r.ok).toBe(true);
    expect(s.challenge).toEqual({ active: 'marathon', progress: 0 });
    expect(s.prestige.pendingChallenge).toBeNull(); // 已消费
    // 再次转生（无 pending）→ 无激活挑战（runs=1 门槛 6 款）
    meetUnlockRequirement(s, 6);
    const r2 = doPrestige(s);
    expect(r2.ok).toBe(true);
    expect(s.challenge.active).toBeNull();
  });

  it('无 pending 转生 → 新周目无激活挑战', () => {
    const s = beginRunWithChallenge([], null);
    expect(s.challenge.active).toBeNull();
    expect(s.prestige.pendingChallenge).toBeNull();
  });

  it('花佬 startMoneyBonus 在转生生效时发放（替代原激活时发放）', () => {
    const s = beginRunWithChallenge(['hardcore'], 'collector');
    expect(s.challenge.active).toBe('collector');
    expect(s.money).toBe(200 + 1000); // 新周目默认资金 + 起步资金
  });
});

describe('挑战：条件修饰', () => {
  it('无薪挑战：在线 tick 不发薪（周期照走、周期数照计）', () => {
    const s = beginRunWithChallenge([], 'no-salary');
    takeJob(s, 'teacher'); // 160 秒/周期，¥100
    for (let i = 0; i < 160; i++) {
      const r = tickSecond(s, () => 0.5);
      if (r.payout) expect(r.payAmount).toBe(0);
    }
    expect(s.money).toBe(200);
    expect(s.jobProgress).toBe(0);
    expect(s.stats.workCycles).toBe(1);
  });

  it('无薪挑战：离线结算同样不发薪（周期照走）', () => {
    const s = beginRunWithChallenge([], 'no-salary');
    takeJob(s, 'teacher');
    accumulateOffline(s, 30 * 60 * 1000); // 1800 秒 → 11 周期余 40
    expect(s.offlineBank.workMoney).toBe(0);
    expect(s.money).toBe(200);
    expect(s.offlineBank.workCycles).toBe(11);
    expect(s.jobProgress).toBe(40);
  });

  it('捡漏之王：刷新间隔 ×0.5、到货件数 ×2（(3+1)×2=8 件，其中 1 件一口价）', () => {
    const s = beginRunWithChallenge(['no-salary'], 'flea-market');
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
    const s = beginRunWithChallenge(['no-salary'], 'merchant');
    const r = refreshXianyu(s, false, lcg(42), 0);
    expect(r.ok).toBe(true);
    expect(s.xianyuBuys).toHaveLength(2);
    expect(s.xianyuBuys.filter(i => i.blind)).toHaveLength(1);
  });

  it('硬核玩家：经验 ×0.6（settleRound 断言）', () => {
    const s = beginRunWithChallenge(['marathon'], 'hardcore');
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
    const s = beginRunWithChallenge([], 'marathon');
    const copy = own(s, 'guoyuan');
    settleRound(s, 'guoyuan', copy.uid, 1, () => 0.99);
    expect(s.collections['guoyuan'].fatigue).toBeCloseTo(3, 10);
  });

  it('柠檬佬：某赏价格 ×1.5（常驻池 + 桌游池），钱不够拒绝不扣费', () => {
    const s = beginRunWithChallenge(['hardcore'], 'whale');
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

  it('柠檬佬：券支付不受价格倍率影响（只乘金钱价）', () => {
    // 常驻池 + 普通券：按 1 张券扣除，金钱分毫不动
    const s = beginRunWithChallenge(['hardcore'], 'whale');
    s.tickets = 2;
    s.money = 500;
    const r = gachaDraw(s, 'perm', 'ticket', () => 0.2); // 4 包牌套
    expect('error' in r).toBe(false);
    expect(s.tickets).toBe(1);
    expect(s.money).toBe(500); // 券支付不走 gachaMoneyPrice
    // 桌游池 + 高级券：同样只扣券
    const s2 = beginRunWithChallenge(['hardcore'], 'whale');
    s2.rotTheme = '演算';
    s2.hiTickets = 1;
    s2.money = 500;
    const r2 = gachaDraw(s2, 'rot', 'hiTicket', () => 0.7);
    expect('error' in r2).toBe(false);
    expect(s2.hiTickets).toBe(0);
    expect(s2.money).toBe(500);
  });

  it('叉叉：成交率 ×1.2（与好口碑乘区并列）', () => {
    const plain = defaultState();
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
    const base = sellChance(2.0, DURABILITY.N, 'N');
    expect(sellChanceFinal(plain, 2.0, DURABILITY.N, 'N')).toBeCloseTo(base, 10);
    expect(sellChanceFinal(s, 2.0, DURABILITY.N, 'N')).toBeCloseTo(base * 1.2, 10);
  });
});

describe('挑战：目标与达成', () => {
  it('xyEarn 目标：成交通道累计净额，达成发币 + challengeDone + active 清空', () => {
    const s = beginRunWithChallenge([], 'no-salary');
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
    // 完成后修饰释放：同周目内可正常游玩（不再受限）
    // 一次性：再选同挑战被拒
    expect(selectPendingChallenge(s, 'no-salary').ok).toBe(false);
  });

  it('花佬：禁止游玩——离线自动游玩跳过（连刷 0 局），但离线工资照发', () => {
    const s = beginRunWithChallenge(['hardcore'], 'collector');
    own(s, 'guoyuan');
    accumulateOffline(s, 10 * 60 * 1000, lcg(3));
    expect(s.offlineBank.playRounds).toBe(0);
    expect(s.collections['guoyuan'].prof).toBe(0);
    // noPlay 只禁游玩，不禁工作：离线工资不受 collector 影响
    const s2 = beginRunWithChallenge(['hardcore'], 'collector');
    takeJob(s2, 'teacher'); // 160 秒/周期
    accumulateOffline(s2, 30 * 60 * 1000); // 1800 秒 → 11 周期
    expect(s2.offlineBank.workMoney).toBeGreaterThan(0);
    expect(s2.offlineBank.workCycles).toBe(11);
  });

  it('花佬：架上 30 款不同实体时 distinctCopies 达成（完成后 noPlay 修饰释放）', () => {
    const s = beginRunWithChallenge(['hardcore'], 'collector');
    const ids = REGULAR_GAMES.slice(0, 30).map(g => g.id);
    for (const id of ids) own(s, id);
    expect(goalProgress(s)).toBe(30);
    const events = checkChallenge(s);
    expect(events).toHaveLength(1);
    expect(s.prestige.coins).toBe(4);
    expect(s.prestige.challengeDone).toContain('collector');
    expect(s.challenge.active).toBeNull();
    // 完成后修饰释放：noPlay 不再拦截（可正常刷精通再转生，无死局）
    const copy = s.copies.find(cp => cp.gameId === ids[0])!;
    expect(() => settleRound(s, copy.gameId, copy.uid, 1, () => 0.99)).not.toThrow();
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
    store.s = beginRunWithChallenge(['hardcore'], 'collector');
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
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
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
    const s2 = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
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

  it('叉叉：一口价盲买买到新款同样被拒（某鱼渠道含盲买）', () => {
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
    for (const id of FIVE_N) own(s, id); // 架上 5 款到限
    s.money = 1e9;
    s.xianyuBuys = [{ gameId: 'shikong', price: 10, durability: 5, sleeved: false, stored: false, blind: true }];
    const r = buyXianyu(s, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('挑战限制');
    expect(s.copies.filter(c => c.gameId === 'shikong')).toHaveLength(0);
    expect(s.xianyuBuys).toHaveLength(1); // 货源未消耗
  });

  it('叉叉：精通池不获得实体，不受款数上限影响', () => {
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
    for (const id of FIVE_N) own(s, id); // 架上 5 款到限
    s.sleeves = 1000;
    const kinds = distinctCopyKinds(s);
    const r = gachaDraw(s, 'master', 'sleeves', () => 0.1); // N 档 → 熟练值
    expect('error' in r).toBe(false);
    if ('error' in r || r.kind !== 'prof') throw new Error('unexpected');
    expect(distinctCopyKinds(s)).toBe(kinds); // 无新实体
    expect(s.copies).toHaveLength(5);
  });

  it('叉叉：开局三选一与老友馈赠在款数上限下正常（开局数量天然低于上限）', () => {
    // 真实流程：doPrestige 已激活 big-earner，随后才走 pickStarter
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
    s.prestige.perks['gift'] = 3; // 老友馈赠 ×3
    const r = pickStarter(s, 'guoyuan', lcg(7));
    expect(r.ok).toBe(true);
    expect(s.copies.length).toBe(4); // 1 自选 + 3 馈赠，未触及 5 款上限
    expect(distinctCopyKinds(s)).toBe(4);
  });

  it('叉叉：卖掉腾位后图鉴保留（distinctCollections 不回落），可再买新款', () => {
    const s = beginRunWithChallenge(['flea-market', 'merchant'], 'big-earner');
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

  it('全 8 个挑战目标类型 → 达成发币（奖励合计 22，币供给配平依据）', () => {
    const REQUIRES: Record<string, string[]> = {
      'flea-market': ['no-salary'], merchant: ['no-salary'], hardcore: ['marathon'],
      'big-earner': ['flea-market', 'merchant'], collector: ['hardcore'], whale: ['hardcore'],
    };
    let total = 0;
    for (const def of CHALLENGES) {
      const s = beginRunWithChallenge(REQUIRES[def.id] ?? [], def.id);
      switch (def.goal.type) {
        case 'xyEarn': s.stats.xyEarned = def.goal.target; break;
        case 'bargainBuys': s.stats.bargainBuys = def.goal.target; break;
        case 'masteryCount':
          for (const g of REGULAR_GAMES.filter(x => x.rarity === 'N').slice(0, def.goal.target)) {
            own(s, g.id, { prof: 20 });
          }
          break;
        case 'plays': s.stats.plays = def.goal.target; break;
        case 'highPriceSold': s.stats.highPriceSold = def.goal.target; break;
        case 'pulls': s.stats.pulls = def.goal.target; break;
        case 'distinctCopies':
          for (const g of REGULAR_GAMES.slice(0, def.goal.target)) own(s, g.id);
          break;
        case 'distinctCollections':
          for (const g of REGULAR_GAMES.slice(0, def.goal.target)) own(s, g.id);
          break;
      }
      const events = checkChallenge(s);
      expect(events, def.id).toHaveLength(1);
      expect(events[0].def.id, def.id).toBe(def.id);
      expect(events[0].reward, def.id).toBe(def.reward);
      expect(s.prestige.coins, def.id).toBe(def.reward);
      expect(s.challenge.active, def.id).toBeNull();
      total += def.reward;
    }
    expect(total).toBe(22);
  });

  it('challenge.progress 与 goalProgress 一致（部分进度原样写回，供页面展示）', () => {
    const s = beginRunWithChallenge([], 'no-salary');
    s.stats.xyEarned = 1000; // 未达标
    expect(checkChallenge(s)).toHaveLength(0);
    expect(s.challenge.progress).toBe(1000);
    expect(goalProgress(s)).toBe(1000);
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
    // 对照：无火眼金睛时存在低于该下限的货源
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
  it('转生保留挑战币/商店/已完成挑战；消费 pending', () => {
    const s = defaultState();
    s.prestige.challengeDone = ['flea-market', 'merchant'];
    s.prestige.coins = 7;
    s.prestige.shop['exp-boost'] = 2;
    meetUnlockRequirement(s);
    expect(selectPendingChallenge(s, 'big-earner').ok).toBe(true);
    expect(doPrestige(s).ok).toBe(true);
    expect(s.challenge.active).toBe('big-earner');
    expect(s.prestige.pendingChallenge).toBeNull();
    expect(s.prestige.coins).toBe(7);
    expect(s.prestige.shop).toEqual({ 'exp-boost': 2 });
    expect(s.prestige.challengeDone).toEqual(['flea-market', 'merchant']);
  });

  it('转生重置进行中的挑战（active 不跨周目）', () => {
    const s = beginRunWithChallenge([], 'no-salary');
    expect(s.challenge.active).toBe('no-salary');
    meetUnlockRequirement(s, 6); // runs=1 门槛 6 款
    expect(doPrestige(s).ok).toBe(true);
    expect(s.challenge.active).toBeNull(); // 未完成挑战不带到下周目
  });
});

describe('挑战：存档迁移（v13 → v14）', () => {
  it('v13 旧档 normalize 后 pendingChallenge 补默认值', () => {
    const s = defaultState();
    const old = JSON.parse(serialize(s)) as Record<string, unknown>;
    old.saveVersion = 13;
    delete old.challenge;
    old.prestige = { insight: 3, perks: {}, runs: 1, lastGain: 3, coins: 0, shop: {}, challengeDone: [] };
    old.stats = {
      plays: 1, pulls: 0, workCycles: 0, soldCount: 0, tbBought: 0, xyBought: 0,
      pityHits: 0, highPriceSold: 0, bargainBuys: 0, xyEarned: 0, comeback: false, respecCount: 0,
    };
    const m = parseSave(JSON.stringify(old));
    expect(m).not.toBeNull();
    expect(m!.saveVersion).toBe(SAVE_VERSION);
    expect(m!.challenge).toEqual({ active: null, progress: 0 });
    expect(m!.prestige.pendingChallenge).toBeNull();
  });

  it('v14 档保留 pending/active；未知挑战 id 剔除', () => {
    const s = defaultState();
    s.challenge = { active: 'marathon', progress: 55 };
    s.prestige.pendingChallenge = 'flea-market'; // 前置 no-salary 已完成
    s.prestige.coins = 5;
    s.prestige.shop = { 'exp-boost': 2 };
    s.prestige.challengeDone = ['no-salary'];
    s.stats.xyEarned = 42;
    const dirty = JSON.parse(serialize(s)) as Record<string, unknown>;
    (dirty.challenge as Record<string, unknown>).active = 'ghost';
    const pres = dirty.prestige as Record<string, unknown>;
    pres.pendingChallenge = 'ghost';
    pres.challengeDone = ['no-salary', 'ghost'];
    pres.shop = { 'exp-boost': 1, ghost: 2 };
    pres.coins = -5; // 负值脏数据归零
    const m = parseSave(JSON.stringify(dirty));
    expect(m).not.toBeNull();
    expect(m!.challenge).toEqual({ active: null, progress: 0 }); // 未知 active 清空
    expect(m!.prestige.pendingChallenge).toBeNull(); // 未知 pending 清空
    expect(m!.prestige.challengeDone).toEqual(['no-salary']);
    expect(m!.prestige.shop).toEqual({ 'exp-boost': 1 });
    expect(m!.prestige.coins).toBe(0); // 负值归零
    expect(m!.stats.xyEarned).toBe(42);
    // 合法挑战进度原样保留
    const good = JSON.parse(serialize(s)) as Record<string, unknown>;
    const m2 = parseSave(JSON.stringify(good));
    expect(m2!.challenge).toEqual({ active: 'marathon', progress: 55 });
    expect(m2!.prestige.pendingChallenge).toBe('flea-market');
    expect(CHALLENGES.length).toBe(8);
  });
});
