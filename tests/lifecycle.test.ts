import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { memoryStorage, SAVE_KEY, SAVE_VERSION, takeJob } from '../src/core';
import { useGameStore } from '../src/ui/stores/game';
import { own } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-24T12:00:00Z'));
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', memoryStorage());
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('前后台计时', () => {
  it('后台自动保存不改变离开时间，恢复后只结算一次', () => {
    const store = useGameStore();
    store.s.started = true;
    takeJob(store.s, 'teacher');
    store.advanceFrame(100);
    store.advanceFrame(1600); // 已有 1 秒工作进度和 0.5 秒余量
    store.suspendGame();
    const lastSeen = store.s.lastSeen;
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(store.saveGame()).toBe(false);
    store.advanceFrame(601600);
    expect(store.s.lastSeen).toBe(lastSeen);
    expect(store.s.jobProgress).toBe(1);
    store.resumeGame();
    expect(store.s.offlineBank.t).toBe(600000);
    expect(store.s.money).toBe(350); // 3 个工作周期 × ¥100 × 离线折算 0.5
    expect(store.s.jobProgress).toBe(121);
    store.advanceFrame(601700);
    expect(store.s.jobProgress).toBe(121); // 首帧不重复补后台时间
    store.advanceFrame(602200);
    expect(store.s.jobProgress).toBe(122); // 保留前台的 0.5 秒余量
    store.resumeGame();
    expect(store.s.money).toBe(350);
    expect(store.s.offlineBank.t).toBe(600000);
  });

  it('短暂离屏不让时机条超时，不增加阶段进度', () => {
    const store = useGameStore();
    const copy = own(store.s, 'guoyuan');
    store.startPlay('guoyuan', copy.uid);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    store.advanceFrame(100);
    store.advanceFrame(200);
    const before = store.session!.phases[0].t;
    store.suspendGame();
    vi.advanceTimersByTime(30000);
    store.resumeGame();
    store.advanceFrame(30200);
    expect(store.session!.phases[0].t).toBe(before);
    expect(store.session!.timing).not.toBeNull();
    expect(store.session!.timing!.t0).toBe(Date.now());
    vi.restoreAllMocks();
  });

  it('前台卡顿后补足每秒 tick', () => {
    const store = useGameStore();
    takeJob(store.s, 'teacher');
    store.advanceFrame(100);
    store.advanceFrame(5600);
    expect(store.s.jobProgress).toBe(5);
    expect(store.secAcc).toBe(500);
  });
});

describe('存档失败保护', () => {
  it('损坏或更新版本的原档不会被启动流程和自动保存覆盖', () => {
    for (const raw of ['{broken', JSON.stringify({ saveVersion: SAVE_VERSION + 1 })]) {
      localStorage.setItem(SAVE_KEY, raw);
      const store = useGameStore();
      store.boot();
      expect(store.saveBlocked).toBe(true);
      expect(store.saveGame()).toBe(false);
      expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
      expect(store.saveNotice).toContain('保护原数据');
    }
  });

  it('写入失败持续提示，恢复后可以再次保存', () => {
    const store = useGameStore();
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', { ...storage, setItem() { throw new Error('full'); } });
    expect(store.saveGame()).toBe(false);
    expect(store.saveNotice).toContain('保存失败');
    vi.stubGlobal('localStorage', storage);
    expect(store.saveGame()).toBe(true);
    expect(store.saveNotice).toBe('');
  });

  it('导入写入失败时保留当前内存态，不刷新页面', async () => {
    const store = useGameStore();
    store.s.money = 777;
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() { throw new Error('full'); } });
    const file = { text: async () => JSON.stringify({ saveVersion: SAVE_VERSION, money: 10 }) } as File;
    await store.importSaveFile(file);
    expect(store.s.money).toBe(777);
    expect(store.saveNotice).toContain('导入未能保存');
  });
});
