import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION, defaultState, load, memoryStorage, save,
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
    s.job = 'clerk';
    s.owned['guoyuan'] = { count: 1, prof: 7, fatigue: 3, sleeved: true, stored: false, rulesRead: true };
    s.attrExp['谋略'] = 42;
    s.stats.plays = 9;
    save(s, storage);
    expect(load(storage)).toEqual(s);
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

  it('原型 v3 存档 → 迁移到当前版本：剥掉死字段 attrs、补默认字段、归一化 owned 条目', () => {
    const v3 = {
      saveVersion: 3,
      money: 500, sleeves: 80, tickets: 2,
      attrs: { 谋略: 0, 演算: 0 }, attrExp: { 谋略: 10 },
      owned: {
        guoyuan: { count: 1, prof: 3, fatigue: 1 }, // 缺布尔字段（模拟旧存档）
      },
      taobaoStock: { guoyuan: 0 },
      xianyu: [], pity: 5, job: 'calc', started: true,
      offlineBank: { t: 60000, money: 120 },
      lastSeen: 1111111111, stats: { plays: 3, pulls: 1 },
      // 无 xyNext（原型旧存档兜底场景）
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(v3));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.money).toBe(500);
    expect('attrs' in s!).toBe(false);
    expect(s!.xyNext).toBe(0); // 默认填充
    expect(s!.owned['guoyuan']).toEqual({
      count: 1, prof: 3, fatigue: 1, sleeved: false, stored: false, rulesRead: false,
    });
    // attrExp 补齐全部六维
    expect(Object.keys(s!.attrExp)).toHaveLength(6);
    expect(s!.attrExp['谋略']).toBe(10);
  });

  it('脏数据兜底：负数 count / 非法 owned 条目 / 缺 stats', () => {
    const dirty = {
      saveVersion: SAVE_VERSION,
      money: 'abc', sleeves: -5,
      owned: { guoyuan: { count: -2, prof: 'x' }, bad: 'not-object', ghost: null },
      stats: null, offlineBank: undefined,
    };
    const storage = memoryStorage();
    storage.setItem('bgcollector_save', JSON.stringify(dirty));
    const s = load(storage);
    expect(s).not.toBeNull();
    expect(s!.money).toBe(200); // 非法值回退默认
    expect(s!.sleeves).toBe(0); // 负值归零
    expect(s!.owned['guoyuan'].count).toBe(0);
    expect(s!.owned['bad']).toBeUndefined();
    expect(s!.stats).toEqual({ plays: 0, pulls: 0 });
  });
});
