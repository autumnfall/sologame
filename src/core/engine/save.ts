import { SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { DURABILITY, SELL_SLOTS_MAX } from '../data/balance';
import { PERKS } from '../data/prestige';
import { gameById } from '../data/games';
import { defaultState, genClientId } from '../state';
import { rankCmp } from './records';
import type { CollectionEntry, Copy, GameState, Listing, MarketItem, OfflineBank, RunRecord } from '../state';
import type { Attr } from '../data/constants';

/** 存储适配器：默认 localStorage，测试中可注入内存实现 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
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
  // v6 → v7（转生系统）：新增 prestige 元进度（阅历/天赋/周目数）
  6: raw => ({ ...raw, prestige: { insight: 0, perks: {}, runs: 0, lastGain: 0 } }),
  // v7 → v8（挂售独立 30s 判定 / 移除手动职业 tryout / 离线总结弹窗）：
  // 旧未领取离线收益直接入账；offlineBank 换新结构；旧职业 tryout 清空
  7: raw => {
    const old = isRecord(raw.offlineBank) ? raw.offlineBank : {};
    const keep = typeof old.money === 'number' && Number.isFinite(old.money) ? old.money : 0;
    const { offlineBank: _drop, job: oldJob, ...rest } = raw;
    void _drop;
    return {
      ...rest,
      money: (typeof raw.money === 'number' ? raw.money : 0) + keep,
      job: oldJob === 'tryout' ? null : oldJob,
      xySellNext: 0,
      offlineBank: { t: 0, workMoney: 0, workCycles: 0, playMoney: 0, playRounds: 0, exp: {}, games: [] },
    };
  },
  // v8 → v9（成就系统）：新增 achievements/settings；stats 补事件计数器
  8: raw => ({
    ...raw,
    achievements: [],
    settings: { autoSwitch: 'off' },
    stats: {
      ...(isRecord(raw.stats) ? raw.stats : {}),
      workCycles: 0, soldCount: 0, tbBought: 0, xyBought: 0,
      pityHits: 0, highPriceSold: 0, bargainBuys: 0, comeback: false, respecCount: 0,
    },
  }),
  // v9 → v10（实体锁定 + 快速上架开关）：均为新增可选字段，归一化时补默认值，无需改写数据
  9: raw => ({ ...raw }),
  // v10 → v11（排行榜：玩家名/本周目开始时间/本地榜/客户端 id）：均为新增可选字段，归一化时补默认值
  10: raw => ({ ...raw }),
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
 * 从 JSON 文本导入存档（导出文件/粘贴串）：
 * 解析 → 版本检查 → 迁移链 → 归一化。损坏或版本过高返回 null。
 */
export function parseSave(json: string): GameState | null {
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json);
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

/**
 * 读取并迁移存档；返回 null 表示无存档或已损坏（调用方应新开一局）。
 * 版本高于当前版本（来自更新版本的客户端）同样返回 null。
 */
export function load(storage: StorageLike = defaultStorage()): GameState | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  return parseSave(raw);
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
      ...(v.resold === true ? { resold: true } : {}),
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
        ...(c.locked === true ? { locked: true } : {}),
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
  const bankExp = isRecord(bank.exp) ? bank.exp : {};
  const games = Array.isArray(bank.games)
    ? bank.games.filter(isRecord).map(g => ({
        gameId: String(g.gameId ?? ''),
        rounds: Math.floor(num(g.rounds, 0)),
        wear: num(g.wear, 0),
      })).filter(g => g.gameId && g.rounds > 0)
    : [];
  const presRaw = isRecord(data.prestige) ? data.prestige : {};
  const perksRaw = isRecord(presRaw.perks) ? presRaw.perks : {};
  const perks: Record<string, number> = {};
  const knownPerks = new Set(PERKS.map(p => p.id));
  for (const [id, lv] of Object.entries(perksRaw)) {
    if (!knownPerks.has(id)) continue; // 未知天赋（旧档脏数据/已下线天赋）剔除
    const n = typeof lv === 'number' && Number.isFinite(lv) ? Math.floor(lv) : 0;
    if (n > 0) perks[id] = n;
  }
  return {
    ...s,
    ...data,
    saveVersion: SAVE_VERSION,
    prestige: {
      insight: num(presRaw.insight, 0),
      perks,
      runs: Math.floor(num(presRaw.runs, 0)),
      lastGain: num(presRaw.lastGain, 0),
    },
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
    sellSlots: clampInt(data.sellSlots, 1, SELL_SLOTS_MAX, 1),
    marketSlots: clampInt(data.marketSlots, 3, 7, 3),
    xyNext: num(data.xyNext, 0),
    xySellNext: num(data.xySellNext, 0),
    pity: num(data.pity, 0),
    pityRot: num(data.pityRot, 0),
    rotTheme: typeof data.rotTheme === 'string' ? data.rotTheme as Attr : null,
    rotNext: num(data.rotNext, 0),
    job: typeof data.job === 'string' ? data.job : null,
    jobProgress: num(data.jobProgress, 0),
    started: data.started === true,
    offlineBank: {
      t: num(bank.t, 0),
      workMoney: num(bank.workMoney, 0),
      workCycles: Math.floor(num(bank.workCycles, 0)),
      playRounds: Math.floor(num(bank.playRounds, 0)),
      exp: Object.fromEntries(
        Object.entries(bankExp).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)),
      ) as OfflineBank['exp'],
      games,
    },
    lastSeen: num(data.lastSeen, Date.now()),
    stats: {
      plays: num(stats.plays, 0),
      pulls: num(stats.pulls, 0),
      workCycles: Math.floor(num(stats.workCycles, 0)),
      soldCount: Math.floor(num(stats.soldCount, 0)),
      tbBought: Math.floor(num(stats.tbBought, 0)),
      xyBought: Math.floor(num(stats.xyBought, 0)),
      pityHits: Math.floor(num(stats.pityHits, 0)),
      highPriceSold: Math.floor(num(stats.highPriceSold, 0)),
      bargainBuys: Math.floor(num(stats.bargainBuys, 0)),
      comeback: stats.comeback === true,
      respecCount: Math.floor(num(stats.respecCount, 0)),
    },
    achievements: Array.isArray(data.achievements)
      ? data.achievements.filter((id): id is string => typeof id === 'string')
      : [],
    playerName: typeof data.playerName === 'string' ? data.playerName.slice(0, 24) : '',
    runStartedAt: num(data.runStartedAt, Date.now()),
    localBoard: normalizeBoard(data.localBoard),
    clientId: typeof data.clientId === 'string' && data.clientId ? data.clientId : genClientId(),
    settings: {
      autoSwitch: (isRecord(data.settings) && data.settings.autoSwitch === 'fatigue') || (isRecord(data.settings) && data.settings.autoSwitch === 'mastery')
        ? data.settings.autoSwitch
        : 'off',
      quickList: isRecord(data.settings) && data.settings.quickList === true,
    },
  };
}

function num(v: unknown, fallback: number): number {
  // 非法值回退默认；负值视为脏数据，归零
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : fallback;
}

/** 本地排行榜归一化：只保留结构合法的记录，按耗时升序、截断前 10 */
function normalizeBoard(raw: unknown): RunRecord[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.filter(isRecord).map(r => ({
    name: typeof r.name === 'string' ? r.name.slice(0, 24) : '',
    ms: num(r.ms, 0),
    runs: Math.floor(num(r.runs, 0)),
    insight: num(r.insight, 0),
    achievements: Math.floor(num(r.achievements, 0)),
    mastered: Math.floor(num(r.mastered, 0)),
    at: num(r.at, 0),
    ...(typeof r.clientId === 'string' && r.clientId ? { clientId: r.clientId } : {}),
  })).filter(r => r.ms > 0);
  list.sort(rankCmp);
  return list.slice(0, 10);
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

/** 清档重开（重新开始） */
export function wipeSave(storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // 同上：静默失败
  }
}
