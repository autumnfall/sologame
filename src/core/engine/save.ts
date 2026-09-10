import { SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { DURABILITY } from '../data/balance';
import { gameById } from '../data/games';
import { defaultState } from '../state';
import type { CollectionEntry, Copy, GameState, Listing, MarketItem } from '../state';
import type { Attr } from '../data/constants';

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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
  // v4 → v5（收藏/实体分离）：owned → collections+copies；xianyu → xianyuBuys；补市场/某赏新字段
  4: raw => migrateV4toV5(raw),
  // v5 → v6（职业周期制）：rate 字段弃用、新增 jobProgress；旧职业 id 映射到新职业
  5: raw => {
    const JOB_MAP_OLD: Record<string, string> = { clerk: 'teacher', editor: 'writer', designer: 'consultant' };
    const job = typeof raw.job === 'string' ? (JOB_MAP_OLD[raw.job] ?? raw.job) : null;
    const { rate: _rate, ...rest } = raw;
    void _rate;
    return { ...rest, job, jobProgress: 0 };
  },
};

function migrateV4toV5(raw: Record<string, unknown>): Record<string, unknown> {
  const collections: Record<string, CollectionEntry> = {};
  const copies: Copy[] = [];
  let nextUid = 1;
  const owned = isRecord(raw.owned) ? raw.owned : {};
  for (const [id, v] of Object.entries(owned)) {
    if (!isRecord(v)) continue;
    const count = typeof v.count === 'number' && v.count > 0 ? Math.floor(v.count) : 0;
    if (count === 0) continue;
    collections[id] = {
      firstOpened: true,
      prof: typeof v.prof === 'number' ? v.prof : 0,
      fatigue: typeof v.fatigue === 'number' ? v.fatigue : 0,
      rulesRead: v.rulesRead === true,
    };
    // 满耐久新实体；牌套/收纳挂在第一个实体上
    const maxDur = DURABILITY[gameById(id).rarity];
    for (let i = 0; i < count; i++) {
      copies.push({
        uid: nextUid++,
        gameId: id,
        durability: maxDur,
        sleeved: i === 0 && v.sleeved === true,
        stored: i === 0 && v.stored === true,
      });
    }
  }
  // 旧某鱼货源 → 在售实体（耐久按满）
  const xianyuBuys: MarketItem[] = [];
  if (Array.isArray(raw.xianyu)) {
    for (const it of raw.xianyu) {
      if (!isRecord(it) || typeof it.id !== 'string') continue;
      let g;
      try {
        g = gameById(it.id);
      } catch {
        continue; // 已下架/未知的桌游跳过
      }
      xianyuBuys.push({
        gameId: it.id,
        price: typeof it.price === 'number' ? it.price : g.marketPrice,
        durability: DURABILITY[g.rarity],
        sleeved: false,
        stored: false,
      });
    }
  }
  // 旧库存（0/1）→ 新库存：0 视为已买过 → 保守给 0；未收藏/未买过的款缺省 = 满额（在购买处用 ?? TAOBAO_STOCK 处理）
  const taobaoStock: Record<string, number> = {};
  const stockSource = isRecord(raw.taobaoStock) ? raw.taobaoStock : {};
  for (const id of Object.keys(collections)) {
    if (stockSource[id] === 0) taobaoStock[id] = 0;
  }
  const { taobaoStock: _drop, xianyu: _drop2, owned: _drop3, ...rest } = raw;
  void _drop; void _drop2; void _drop3;
  return {
    ...rest,
    collections,
    copies,
    nextUid,
    taobaoStock,
    xianyuBuys,
    listings: [] as Listing[],
    sellSlots: 1,
    marketSlots: 3,
    hiTickets: 0,
    pityRot: 0,
    rotTheme: null,
    rotNext: 0,
  };
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

/** 以默认存档为底，把存档数据归一化：补新字段、剔脏字段、填充条目缺省值 */
function normalize(data: Record<string, unknown>): GameState {
  const s = defaultState();
  const collections: GameState['collections'] = {};
  const collRaw = isRecord(data.collections) ? data.collections : {};
  for (const [id, v] of Object.entries(collRaw)) {
    if (!isRecord(v)) continue;
    collections[id] = {
      firstOpened: v.firstOpened === true,
      prof: num(v.prof, 0),
      fatigue: num(v.fatigue, 0),
      rulesRead: v.rulesRead === true,
    };
  }
  const copies: Copy[] = [];
  if (Array.isArray(data.copies)) {
    for (const c of data.copies) {
      if (!isRecord(c) || typeof c.gameId !== 'string') continue;
      copies.push({
        uid: num(c.uid, 0),
        gameId: c.gameId,
        durability: typeof c.durability === 'number' ? Math.max(0, c.durability) : DURABILITY[gameById(c.gameId).rarity],
        sleeved: c.sleeved === true,
        stored: c.stored === true,
      });
    }
  }
  const listings: Listing[] = Array.isArray(data.listings)
    ? data.listings.filter(isRecord).map(l => ({ copyUid: num(l.copyUid, 0), price: num(l.price, 0) }))
    : [];
  const xianyuBuys: MarketItem[] = Array.isArray(data.xianyuBuys)
    ? data.xianyuBuys.filter(isRecord).map(it => ({
        gameId: String(it.gameId ?? ''),
        price: num(it.price, 0),
        durability: num(it.durability, 0),
        sleeved: it.sleeved === true,
        stored: it.stored === true,
        ...(it.blind === true ? { blind: true } : {}),
      })).filter(it => it.gameId && it.price > 0)
    : [];
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
    hiTickets: num(data.hiTickets, 0),
    attrExp: attrExp as GameState['attrExp'],
    collections,
    copies,
    nextUid: num(data.nextUid, copies.reduce((m, c) => Math.max(m, c.uid + 1), 1)),
    taobaoStock: (isRecord(data.taobaoStock) ? data.taobaoStock : {}) as GameState['taobaoStock'],
    xianyuBuys,
    listings,
    sellSlots: clampInt(data.sellSlots, 1, 5, 1),
    marketSlots: clampInt(data.marketSlots, 3, 7, 3),
    xyNext: num(data.xyNext, 0),
    pity: num(data.pity, 0),
    pityRot: num(data.pityRot, 0),
    rotTheme: typeof data.rotTheme === 'string' ? data.rotTheme as Attr : null,
    rotNext: num(data.rotNext, 0),
    job: typeof data.job === 'string' ? data.job : null,
    jobProgress: num(data.jobProgress, 0),
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

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
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
