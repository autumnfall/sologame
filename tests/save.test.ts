import { describe, expect, it } from 'vitest';
import {
  DURABILITY, SAVE_VERSION, defaultState, load, memoryStorage, parseSave, save, serialize, wipeSave,
} from '../src/core';

function stateWithLastSeen(t: number) {
  const s = defaultState();
  s.lastSeen = t;
  return s;
}

describe('存档系统', () => {
  it('save → load 往返一致', () => {
    const storage = memoryStorage();
    const s = stateWithLastSeen(1234567890);
    s.money = 1234.5;
    s.started = true;
    s.job = 'teacher';
    s.jobProgress = 42;
    s.collections['guoyuan'] = { firstOpened: true, prof: 7, fatigue: 3, rulesRead: true };
    s.copies.push({ uid: 1, gameId: 'guoyuan', durability: 6, sleeved: true, stored: false });
    s.nextUid = 2;
    s.listings.push({ copyUid: 1, price: 50 });
    s.xianyuBuys.push({ gameId: 'mori', price: 200, durability: 30, sleeved: false, stored: true });
    s.sellSlots = 2;
    s.marketSlots = 4;
    s.hiTickets = 3;
    s.rotTheme = '演算';
    s.pityRot = 7;
    s.attrExp['谋略'] = 42;
    s.stats.plays = 9;
    save(s, storage);
    expect(load(storage)).toEqual(s);
  });

  it('导出 → 导入：parseSave 往返一致；旧版导出文件自动迁移', () => {
    const s = stateWithLastSeen(1234567890);
    s.money = 777;
    s.started = true;
    s.collections['guoyuan'] = { firstOpened: true, prof: 3, fatigue: 1, rulesRead: true };
    const json = serialize(s);
    const imported = parseSave(json);
    expect(imported).not.toBeNull();
    expect(imported!.money).toBe(777);
    expect(imported!.collections['guoyuan'].prof).toBe(3);
    // 旧版（v5）导出串也能导入并迁移
    const v5 = JSON.parse(json) as Record<string, unknown>;
    v5.saveVersion = 5;
    v5.job = 'clerk';
    const migrated = parseSave(JSON.stringify(v5));
    expect(migrated).not.toBeNull();
    expect(migrated!.saveVersion).toBe(SAVE_VERSION);
    expect(migrated!.job).toBe('teacher');
  });

  it('导入：损坏 JSON / 非对象 / 版本过高 → null', () => {
    expect(parseSave('{not json')).toBeNull();
    expect(parseSave('[1,2,3]')).toBeNull();
    expect(parseSave(JSON.stringify({ saveVersion: SAVE_VERSION + 1, money: 1 }))).toBeNull();
  });

  it('wipeSave 清档后 load 返回 null', () => {
    const storage = memoryStorage();
    save(stateWithLastSeen(1), storage);
    expect(load(storage)).not.toBeNull();
    wipeSave(storage);
    expect(load(storage)).toBeNull();
  });

  it('无存档 / 损坏 JSON / 非对象 → null', () => {
    expect(load(memoryStorage())).toBeNull();
    const bad = memoryStorage();
    bad.setItem('bgcollector_save', '{not json');
    expect(load(bad)).toBeNull();
    const arr = memoryStorage();
    arr.setItem('bgcollector_save', '[1,2,3]');
    expect(load(arr)).toBeNull();
  });

  it('高于当前版本的存档拒绝读取', () => {
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify({ saveVersion: SAVE_VERSION + 1, money: 1 }));
    expect(load(storage)).toBeNull();
  });

  it('迁移链断裂（v0）→ null', () => {
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify({ money: 100 }));
    expect(load(storage)).toBeNull();
  });

  it('原型 v3 存档 → 迁移到最新版：owned→collections+满耐久实体，xianyu→xianyuBuys，剥掉 attrs', () => {
    const v3 = {
      saveVersion: 3,
      money: 500, sleeves: 80, tickets: 2,
      attrs: { 谋略: 0, 演算: 0 }, attrExp: { 谋略: 10 },
      owned: {
        guoyuan: { count: 1, prof: 3, fatigue: 1 }, // 缺布尔字段（模拟旧存档）
      },
      taobaoStock: { guoyuan: 0 },
      xianyu: [{ id: 'mori', price: 260 }], pity: 5, job: 'calc', started: true,
      offlineBank: { t: 60000, money: 120 },
      lastSeen: 1111111111, stats: { plays: 3, pulls: 1 },
      // 无 xyNext（原型旧存档兜底场景）
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(v3));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.money).toBe(620); // 500 + 旧未领取离线收益 120 由 v8 迁移直接入账
    expect(s!.offlineBank).toEqual({ t: 0, workMoney: 0, workCycles: 0, playRounds: 0, exp: {}, games: [] });
    expect(s!.xySellNext).toBe(0);
    expect('attrs' in s!).toBe(false);
    expect(s!.xyNext).toBe(0); // 默认填充
    // owned → collections + copies
    expect(s!.collections['guoyuan']).toEqual({ firstOpened: true, prof: 3, fatigue: 1, rulesRead: false });
    expect(s!.copies).toEqual([
      { uid: 1, gameId: 'guoyuan', durability: DURABILITY.N, sleeved: false, stored: false },
    ]);
    expect(s!.nextUid).toBe(2);
    // 旧 xianyu → 在售实体（满耐久）
    expect(s!.xianyuBuys).toEqual([
      { gameId: 'mori', price: 260, durability: DURABILITY.R, sleeved: false, stored: false },
    ]);
    // 旧库存 0 → 售罄保留；新字段默认
    expect(s!.taobaoStock['guoyuan']).toBe(0);
    expect(s!.sellSlots).toBe(1);
    expect(s!.marketSlots).toBe(3);
    expect(s!.hiTickets).toBe(0);
    expect(s!.listings).toEqual([]);
    // attrExp 补齐全部六维
    expect(Object.keys(s!.attrExp)).toHaveLength(6);
    expect(s!.attrExp['谋略']).toBe(10);
  });

  it('v4 存档多副本/牌套收纳迁移：count 个满耐久实体，牌套收纳挂第一个', () => {
    const v4 = {
      saveVersion: 4,
      money: 100, sleeves: 50, tickets: 0,
      attrExp: {},
      owned: {
        guoyuan: { count: 2, prof: 9, fatigue: 2, sleeved: true, stored: false, rulesRead: true },
      },
      taobaoStock: {}, xianyu: [], pity: 0, job: null, started: true,
      offlineBank: { t: 0, money: 0, log: [] },
      lastSeen: 2222222222, stats: { plays: 9, pulls: 0 },
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(v4));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.collections['guoyuan']).toEqual({ firstOpened: true, prof: 9, fatigue: 2, rulesRead: true });
    expect(s!.copies).toHaveLength(2);
    expect(s!.copies[0].sleeved).toBe(true);
    expect(s!.copies[1].sleeved).toBe(false);
    expect(s!.copies.every(c => c.durability === DURABILITY.N)).toBe(true);
    expect(s!.nextUid).toBe(3);
  });

  it('v5 → v6（职业周期制）：旧职业 id 映射（clerk→teacher / editor→writer / designer→consultant），jobProgress 清零', () => {
    for (const [old, mapped] of [['clerk', 'teacher'], ['editor', 'writer'], ['designer', 'consultant'], ['calc', 'calc']] as const) {
      const v5 = {
        saveVersion: 5,
        money: 100, job: old, jobProgress: 77, rate: 1.0,
        collections: {}, copies: [], xianyuBuys: [], listings: [],
        offlineBank: { t: 0, money: 0, log: [] }, lastSeen: 1, stats: { plays: 0, pulls: 0 },
      };
      const storage = memoryStorage();
      storage.setItem('bgcollector_save', JSON.stringify(v5));
      const s = load(storage);
      expect(s).not.toBeNull();
      expect(s!.job).toBe(mapped);
      expect(s!.jobProgress).toBe(0);
      expect('rate' in s!).toBe(false); // 旧 rate 字段已剥掉
    }
  });

  it('v7 → v8：挂售独立计时；手动职业 tryout 清空；旧离线收益入账', () => {
    const v7 = {
      saveVersion: 7,
      money: 100, job: 'tryout',
      collections: {}, copies: [], xianyuBuys: [], listings: [],
      offlineBank: { t: 0, money: 80, log: [] }, lastSeen: 1, stats: { plays: 0, pulls: 0 },
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(v7));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.money).toBe(180); // 旧未领取的 80 直接入账
    expect(s!.job).toBeNull();
    expect(s!.xySellNext).toBe(0);
    expect(s!.offlineBank.workMoney).toBe(0);
  });

  it('v10 → v11（排行榜字段）：playerName/localBoard/clientId 补默认，runStartedAt 填充', () => {
    const s = stateWithLastSeen(1234567890);
    s.playerName = '测试玩家';
    s.localBoard.push({ name: '测试玩家', ms: 60000, runs: 1, insight: 10, achievements: 2, mastered: 4, at: 999 });
    const v10 = JSON.parse(serialize(s)) as Record<string, unknown>;
    v10.saveVersion = 10;
    delete v10.playerName;
    delete v10.runStartedAt;
    delete v10.localBoard;
    delete v10.clientId;
    const migrated = parseSave(JSON.stringify(v10));
    expect(migrated).not.toBeNull();
    expect(migrated!.saveVersion).toBe(SAVE_VERSION);
    expect(migrated!.playerName).toBe('');
    expect(migrated!.localBoard).toEqual([]);
    expect(migrated!.clientId).toBeTruthy();
    expect(migrated!.runStartedAt).toBeGreaterThan(0);
  });

  it('脏数据兜底：负值归零 / 非法实体条目 / 缺 stats', () => {
    const dirty = {
      saveVersion: SAVE_VERSION,
      money: 'abc', sleeves: -5, sellSlots: 99, marketSlots: 0,
      copies: [{ uid: 'x', gameId: 'guoyuan', durability: -3 }, { bad: true }, null],
      collections: { guoyuan: { firstOpened: 1, prof: 'y' }, bad: 'nope' },
      stats: null, offlineBank: undefined,
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(dirty));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.money).toBe(200); // 非法值回退默认
    expect(s!.sleeves).toBe(0); // 负值归零
    expect(s!.sellSlots).toBe(8); // 越界收敛（上限 8）
    expect(s!.marketSlots).toBe(3);
    expect(s!.copies).toHaveLength(1);
    expect(s!.copies[0].durability).toBe(0); // 负值耐久归零（视为磨光）
    expect(s!.collections['guoyuan'].firstOpened).toBe(false); // 非 true 即 false
    expect(s!.collections['bad']).toBeUndefined();
    expect(s!.stats).toEqual({
      plays: 0, pulls: 0, workCycles: 0, soldCount: 0, tbBought: 0, xyBought: 0,
      pityHits: 0, highPriceSold: 0, bargainBuys: 0, xyEarned: 0, comeback: false, respecCount: 0,
    });
  });
});
