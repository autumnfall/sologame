import { SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { defaultState } from '../state';
import type { GameState, OwnedGame } from '../state';

/** 存储适配器：默认 localStorage，测试中可注入内存实现 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
}

function defaultStorage(): StorageLike {
  return typeof localStorage === 'undefined' ? memoryStorage() : localStorage;
}

/**
 * 存档迁移链：MIGRATIONS[v] 把 v 版存档升级为 v+1 版。
 * 新增迁移时：SAVE_VERSION +1，在这里加对应函数。
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v3（原型最终版）→ v4（正式版）：去掉从未被读取的死字段 attrs
  3: raw => {
    const { attrs: _attrs, ...rest } = raw;
    return rest;
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 读取并迁移存档；返回 null 表示无存档或已损坏（调用方应新开一局）。
 * 版本高于当前版本（来自更新版本的客户端）同样返回 null。
 */
export function load(storage: StorageLike = defaultStorage()): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    data = parsed;
  } catch {
    return null;
  }
  let version = typeof data.saveVersion === 'number' ? data.saveVersion : 0;
  if (version > SAVE_VERSION) {
    console.warn(`存档版本 ${version} 高于当前支持的 ${SAVE_VERSION}，无法读取`);
    return null;
  }
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return null; // 迁移链断裂，视为损坏
    data = migrate(data);
    version++;
  }
  return normalize(data);
}

/** 以默认存档为底，把存档数据归一化：补新字段、剔脏字段、填充 owned 条目缺省值 */
function normalize(data: Record<string, unknown>): GameState {
  const s = defaultState();
  const ownedRaw = isRecord(data.owned) ? data.owned : {};
  const owned: GameState['owned'] = {};
  for (const [id, v] of Object.entries(ownedRaw)) {
    if (!isRecord(v)) continue;
    owned[id] = { count: 0, prof: 0, fatigue: 0, sleeved: false, stored: false, rulesRead: false, ...v } as OwnedGame;
    if (typeof owned[id].count !== 'number' || owned[id].count < 0) owned[id].count = 0;
  }
  const attrExp = { ...s.attrExp, ...(isRecord(data.attrExp) ? data.attrExp : {}) };
  const stats = isRecord(data.stats) ? data.stats : {};
  const bank = isRecord(data.offlineBank) ? data.offlineBank : {};
  return {
    ...s,
    ...data,
    saveVersion: SAVE_VERSION,
    money: num(data.money, s.money),
    sleeves: num(data.sleeves, s.sleeves),
    tickets: num(data.tickets, s.tickets),
    attrExp: attrExp as GameState['attrExp'],
    owned,
    taobaoStock: (isRecord(data.taobaoStock) ? data.taobaoStock : {}) as GameState['taobaoStock'],
    xianyu: Array.isArray(data.xianyu) ? (data.xianyu as GameState['xianyu']) : [],
    xyNext: num(data.xyNext, 0),
    pity: num(data.pity, 0),
    job: typeof data.job === 'string' ? data.job : null,
    started: data.started === true,
    offlineBank: {
      t: num(bank.t, 0),
      money: num(bank.money, 0),
      log: Array.isArray(bank.log) ? (bank.log as string[]) : [],
    },
    lastSeen: num(data.lastSeen, Date.now()),
    stats: {
      plays: num(stats.plays, 0),
      pulls: num(stats.pulls, 0),
    },
  };
}

function num(v: unknown, fallback: number): number {
  // 非法值回退默认；负值视为脏数据，归零
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : fallback;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function save(state: GameState, storage: StorageLike = defaultStorage()): void {
  state.lastSeen = Date.now();
  try {
    storage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // 存储满/隐私模式等：静默失败，不阻塞游戏
  }
}
