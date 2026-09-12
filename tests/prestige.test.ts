import { describe, expect, it } from 'vitest';
import {
  GACHA_PITY, MASTERY, SAVE_VERSION,
  buyPerk, canPrestige, defaultState, doPrestige, expMult, gachaDraw, gameById,
  insightGain, insightSpent, makeRunRecord, masteredCount, mergeBoard, parseSave, perkCost, perkDefById,
  perkLevel, pickStarter, prestigeUnlockCount, prestigeWeight, recordLocalRun, respecPerks, taobaoPrice,
} from '../src/core';
import { lcg, own } from './helpers';
import type { GameState } from '../src/core';

/** 前 8 款 N 档常规款（精通权重各 1） */
const EIGHT_N = ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska', 'shikong', 'boendi', 'xueyuan'];

function stateWithEightMastered(): GameState {
  const s = defaultState();
  for (const id of EIGHT_N) own(s, id, { prof: MASTERY.N }); // N 精通 = 20 局
  return s;
}

describe('转生：解锁与收益', () => {
  it('解锁门槛随常规款数量伸缩（基础值与 20% 取大）', () => {
    expect(prestigeUnlockCount()).toBeGreaterThanOrEqual(8);
    expect(canPrestige(defaultState())).toBe(false);
    const s = stateWithEightMastered();
    expect(masteredCount(s)).toBe(8);
    expect(canPrestige(s)).toBe(prestigeUnlockCount() <= 8);
  });

  it('权重 = 精通按稀有度累计 + 图鉴加成；隐藏款有额外权重', () => {
    const s = stateWithEightMastered();
    // 8 款 N 精通 = 8；图鉴 8 种 → floor(8/5)=1 → 9
    expect(prestigeWeight(s)).toBe(9);
    own(s, 'hezou', { prof: MASTERY.N }); // N 隐藏款：+1 +4，图鉴 9 种仍只 +1
    expect(prestigeWeight(s)).toBe(14);
  });

  it('首转保底 10；之后每周目至少比上周目多 1', () => {
    const s = stateWithEightMastered();
    expect(insightGain(s)).toBe(10); // sqrt(9)×3=9 < 10 保底
    expect(doPrestige(s).ok).toBe(true);
    expect(s.prestige.runs).toBe(1);
    expect(s.prestige.insight).toBe(10);
    expect(s.prestige.lastGain).toBe(10);
    // 第二周目同样成绩：基础 9，保底 11
    for (const id of EIGHT_N) own(s, id, { prof: MASTERY.N });
    expect(insightGain(s)).toBe(11);
  });

  it('未解锁时 doPrestige 拒绝', () => {
    const s = defaultState();
    own(s, 'guoyuan', { prof: MASTERY.N });
    const r = doPrestige(s);
    expect(r.ok).toBe(false);
    expect(s.prestige.runs).toBe(0);
  });
});

describe('转生：重置保留清单', () => {
  it('清空本周目进度，保留阅历/天赋/生涯统计', () => {
    const s = stateWithEightMastered();
    s.money = 9999;
    s.sleeves = 777;
    s.tickets = 5;
    s.attrExp['谋略'] = 123;
    s.stats.plays = 42;
    s.stats.pulls = 7;
    const r = doPrestige(s);
    expect(r.ok).toBe(true);
    expect(s.collections).toEqual({});
    expect(s.copies).toHaveLength(0);
    expect(s.money).toBeLessThan(1000); // 只剩天赋加成后的开局资金
    expect(s.sleeves).toBe(100);
    expect(s.tickets).toBe(0);
    expect(s.attrExp['谋略']).toBe(0);
    expect(s.job).toBeNull();
    expect(s.started).toBe(false); // 重新三选一
    expect(s.stats.plays).toBe(42); // 生涯统计保留
    expect(s.stats.pulls).toBe(7);
    expect(s.prestige.insight).toBe(10);
  });

  it('天赋开局加成：启动资金与老主顾槽位（在选定开局时结算）', () => {
    const s = stateWithEightMastered();
    s.prestige.insight = 100;
    expect(buyPerk(s, 'fund').ok).toBe(true); // 2
    expect(buyPerk(s, 'fund').ok).toBe(true); // 3
    expect(buyPerk(s, 'sellslot').ok).toBe(true); // 6，当周目立即 +1
    expect(s.sellSlots).toBe(2);
    expect(doPrestige(s).ok).toBe(true);
    expect(s.money).toBe(200); // 开局加成在 pickStarter 结算，转生瞬间只有默认资金
    expect(s.sellSlots).toBe(1);
    pickStarter(s, 'guoyuan');
    expect(s.money).toBe(200 + 600); // 2 级启动资金
    expect(s.sellSlots).toBe(2); // 1 + 1 级老主顾
    expect(insightSpent(s)).toBe(11);
  });

  it('转生后购买的开局加成天赋对本周目同样生效', () => {
    // 模拟新流程：转生到账阅历 → 投资启动资金 → 再开新周目
    const s = stateWithEightMastered();
    expect(doPrestige(s).ok).toBe(true);
    expect(buyPerk(s, 'fund').ok).toBe(true);
    expect(s.money).toBe(200);
    pickStarter(s, 'guoyuan');
    expect(s.money).toBe(500); // 200 + 1 级启动资金
  });
});

describe('转生：天赋商店', () => {
  it('价格 = base + step × 当前等级；满级拒绝', () => {
    const def = perkDefById('fund'); // base 2 step 1
    expect(perkCost(def, 0)).toBe(2);
    expect(perkCost(def, 4)).toBe(6);
    const s = stateWithEightMastered();
    s.prestige.insight = 2;
    expect(buyPerk(s, 'fund').ok).toBe(true);
    expect(buyPerk(s, 'fund').ok).toBe(false); // 阅历不够
    s.prestige.insight = 999;
    for (let i = 1; i < def.max; i++) expect(buyPerk(s, 'fund').ok).toBe(true); // 已 1 级，再升 4 级
    expect(perkLevel(s, 'fund')).toBe(def.max);
    expect(buyPerk(s, 'fund').ok).toBe(false); // 已满级
  });

  it('洗点全额退还', () => {
    const s = stateWithEightMastered();
    s.prestige.insight = 100;
    buyPerk(s, 'fund'); // 2
    buyPerk(s, 'fund'); // 3
    buyPerk(s, 'expall'); // 3
    expect(insightSpent(s)).toBe(8);
    expect(respecPerks(s).ok).toBe(true);
    expect(s.prestige.insight).toBe(100);
    expect(s.prestige.perks).toEqual({});
  });
});

describe('转生：天赋乘区钩子', () => {
  it('触类旁通：全经验 ×1.1/级', () => {
    const s = defaultState();
    const base = expMult(s);
    s.prestige.perks['expall'] = 2;
    expect(expMult(s)).toBeCloseTo(base * 1.21, 10);
  });

  it('会员折扣：某宝价格逐级 -5%', () => {
    const s = defaultState();
    const g = gameById('guoyuan');
    const full = taobaoPrice(s, g);
    s.prestige.perks['tbdiscount'] = 2;
    expect(taobaoPrice(s, g)).toBe(Math.max(1, Math.round(full * 0.9)));
  });

  it('欧非守恒：保底抽数 -5/级（下限 10）', () => {
    const s = defaultState();
    s.prestige.perks['pity'] = 2; // 50 → 40
    s.tickets = 10;
    s.pity = GACHA_PITY - 11; // 39 ≥ 40-1 → 强制保底
    const r = gachaDraw(s, 'perm', 'ticket', () => 0.5); // 0.5 ≥ 0.25 → SR
    expect('error' in r).toBe(false);
    if (!('error' in r) && r.kind === 'game') expect(r.rarity === 'SR' || r.rarity === 'SSR').toBe(true);
    expect(s.pity).toBe(0);
  });

  it('老友馈赠：开局三选一时额外赠送未收藏桌游', () => {
    const s = defaultState();
    s.prestige.perks['gift'] = 2;
    pickStarter(s, 'guoyuan', lcg(7));
    expect(s.collections['guoyuan'].firstOpened).toBe(true);
    const kinds = Object.keys(s.collections).length;
    expect(kinds).toBe(3); // 1 自选 + 2 馈赠
  });
});

describe('转生：存档迁移', () => {
  it('v6 存档补默认 prestige 元进度', () => {
    const s = parseSave(JSON.stringify({ saveVersion: 6, money: 5 }));
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.prestige).toEqual({ insight: 0, perks: {}, runs: 0, lastGain: 0 });
    expect(s!.money).toBe(5);
  });

  it('v7 存档归一化：剔除未知天赋与非法等级', () => {
    const raw = {
      saveVersion: 7,
      prestige: { insight: 20, perks: { fund: 2, ghost: 3, expall: -1 }, runs: 3, lastGain: 9 },
    };
    const s = parseSave(JSON.stringify(raw));
    expect(s!.prestige.insight).toBe(20);
    expect(s!.prestige.perks).toEqual({ fund: 2 });
    expect(s!.prestige.runs).toBe(3);
    expect(s!.prestige.lastGain).toBe(9);
  });
});

describe('转生：周目成绩记录（本地/在线排行榜）', () => {
  it('makeRunRecord：耗时 = 完成 - 开局，数据取转生结算后的周目数/阅历/成就', () => {
    const s = stateWithEightMastered();
    s.playerName = '  测试玩家  ';
    s.achievements = ['a1', 'a2', 'a3'];
    s.runStartedAt = 1_000_000;
    expect(doPrestige(s).ok).toBe(true);
    const rec = makeRunRecord(s, { startedAt: 1_000_000, finishedAt: 4_600_000 });
    expect(rec.name).toBe('测试玩家');
    expect(rec.ms).toBe(3_600_000);
    expect(rec.runs).toBe(1);
    expect(rec.insight).toBe(10);
    expect(rec.achievements).toBe(3);
    expect(rec.clientId).toBe(s.clientId);
  });

  it('recordLocalRun：按耗时升序，只保留前 10 条', () => {
    const s = defaultState();
    const mk = (ms: number) => ({ name: 'n', ms, runs: 1, insight: 1, achievements: 0, at: ms });
    for (let i = 1; i <= 12; i++) recordLocalRun(s, mk(i * 1000));
    expect(s.localBoard).toHaveLength(10);
    expect(s.localBoard[0].ms).toBe(1000);
    expect(s.localBoard[9].ms).toBe(10000); // 最大的 2 条被裁掉
    recordLocalRun(s, mk(500)); // 更快的成绩插到榜首
    expect(s.localBoard[0].ms).toBe(500);
  });

  it('doPrestige：重置本周目开始时间，保留玩家名/本地榜/clientId', () => {
    const s = stateWithEightMastered();
    s.playerName = '老玩家';
    s.runStartedAt = 1;
    recordLocalRun(s, { name: '老玩家', ms: 999, runs: 0, insight: 0, achievements: 0, at: 2 });
    const cid = s.clientId;
    expect(doPrestige(s).ok).toBe(true);
    expect(s.playerName).toBe('老玩家');
    expect(s.localBoard).toHaveLength(1);
    expect(s.clientId).toBe(cid);
    expect(s.runStartedAt).toBeGreaterThan(1); // 重置为转生时刻
  });

  it('mergeBoard：按 clientId 去重取最好成绩，耗时升序截断', () => {
    const merged = mergeBoard([
      { name: 'a', ms: 5000, runs: 1, insight: 0, achievements: 0, at: 1, clientId: 'x' },
      { name: 'a', ms: 3000, runs: 2, insight: 5, achievements: 1, at: 2, clientId: 'x' }, // 同 client 取 3000
      { name: 'b', ms: 4000, runs: 1, insight: 0, achievements: 0, at: 3, clientId: 'y' },
      { name: 'c', ms: 1000, runs: 1, insight: 0, achievements: 0, at: 4 },
    ], 10);
    expect(merged.map(r => r.ms)).toEqual([1000, 3000, 4000]);
  });
});
