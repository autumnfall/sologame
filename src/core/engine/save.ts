import { SAVE_KEY, SAVE_VERSION } from '../data/constants';
import { DURABILITY, SELL_SLOTS_MAX } from '../data/balance';
import { PERKS } from '../data/prestige';
import { CHALLENGES, CHALLENGE_SHOP } from '../data/challenges';
import { DESIGN_DIMS, DESIGN_DURABILITY, ITER_MAX, PLATFORMS, SCALES, THEMES, rarityOf } from '../data/designs';
import { gameById } from '../data/games';
import { defaultState, genClientId, isDesignedId } from '../state';
import { rankCmp } from './records';
import type { Attr } from '../data/constants';
import type { Rarity } from '../data/types';
import type { CollectionEntry, Copy, DesignerState, DesignCampaign, EventHistoryEntry, FailedCampaign, FundedDesign, GameState, Listing, MarketItem, OfflineBank, PendingEvent, Prototype, RunRecord } from '../state';

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
  // v11 → v12（快速上架比例 settings.quickListPct）：新增可选字段，归一化时补默认值，无需改写数据
  11: raw => ({ ...raw }),
  // v12 → v13（挑战场景）：新增 challenge/prestige.coins/shop/challengeDone/stats.xyEarned，
  // 均为新增可选字段，归一化时补默认值并剔除未知 id，无需改写数据
  12: raw => ({ ...raw }),
  // v13 → v14（挑战激活改到转生流程）：新增 prestige.pendingChallenge，
  // 新增可选字段，归一化时补默认值，无需改写数据
  13: raw => ({ ...raw }),
  // v14 → v15（桌游设计师）：新增 designer 状态/Copy.designed；均为新增可选字段，归一化补默认，无需改写数据
  14: raw => ({ ...raw }),
  // v15 → v16（设计师 v5：曝光/预热/平台/事件/两阶段抽成结算）：均为新增可选字段，
  // 旧 campaign/funded 在归一化时补默认值，无需改写数据
  15: raw => ({ ...raw }),
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
      const designed = c.designed === true && isDesignedId(c.gameId);
      if (c.designed === true && !designed) continue; // 脏 designed 标记（id 不在 design-N 空间）剔除
      if (designed && !collections[c.gameId]) continue; // 自创实体必须有对应图鉴条目
      copies.push({
        uid: num(c.uid, 0),
        gameId: c.gameId,
        durability: typeof c.durability === 'number'
          ? Math.max(0, c.durability)
          : designed ? DESIGN_DURABILITY : DURABILITY[gameById(c.gameId).rarity],
        sleeved: !designed && c.sleeved === true,
        stored: !designed && c.stored === true,
        ...(c.locked === true ? { locked: true } : {}),
        ...(designed ? { designed: true } : {}),
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
  // 挑战场景：挑战币/商店等级/已完成挑战（跨周目保留）；未知商店 id 剔除
  const shopRaw = isRecord(presRaw.shop) ? presRaw.shop : {};
  const knownShop = new Set(CHALLENGE_SHOP.map(p => p.id));
  const shop: Record<string, number> = {};
  for (const [id, lv] of Object.entries(shopRaw)) {
    if (!knownShop.has(id)) continue;
    const n = typeof lv === 'number' && Number.isFinite(lv) ? Math.floor(lv) : 0;
    if (n > 0) shop[id] = n;
  }
  const knownChallenges = new Set(CHALLENGES.map(c => c.id));
  const challengeDone = Array.isArray(presRaw.challengeDone)
    ? presRaw.challengeDone.filter((id): id is string => typeof id === 'string' && knownChallenges.has(id))
    : [];
  // 待生效挑战：只接受已登记且未领过奖励的 id
  const pendingRaw = typeof presRaw.pendingChallenge === 'string' ? presRaw.pendingChallenge : null;
  const pendingChallenge = pendingRaw && knownChallenges.has(pendingRaw) && !challengeDone.includes(pendingRaw) ? pendingRaw : null;
  // 进行中的挑战：只接受已登记挑战 id；若已领过奖励（脏数据）则视为无激活
  const chRaw = isRecord(data.challenge) ? data.challenge : {};
  const activeRaw = typeof chRaw.active === 'string' ? chRaw.active : null;
  const active = activeRaw && knownChallenges.has(activeRaw) && !challengeDone.includes(activeRaw) ? activeRaw : null;
  // 桌游设计师（v4 众筹）：兼容 v1 旧字段——旧 prototype（invested/insp、无 name/scale/iter）
  // 迁移为 iter 全 0、体量 standard、名称回落「主题·uid号」；旧 published 数组并入 funded（稀有度按 score 重算）
  const desRaw = isRecord(data.designer) ? data.designer : {};
  const knownThemes = new Set(THEMES.map(t => t.id));
  const knownScales = new Set(SCALES.map(s => s.id));
  const normIter = (raw: unknown): Record<string, number> => {
    const iter: Record<string, number> = {};
    for (const d of DESIGN_DIMS) iter[d.key] = 0;
    if (isRecord(raw)) {
      for (const d of DESIGN_DIMS) iter[d.key] = Math.min(ITER_MAX, Math.max(0, Math.floor(num(raw[d.key], 0))));
    }
    return iter;
  };
  const prototypes: Prototype[] = Array.isArray(desRaw.prototypes)
    ? desRaw.prototypes.filter(isRecord).map(p => {
        const themeId = String(p.themeId ?? '');
        const uid = num(p.uid, 0);
        const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 10) : `${themeId}·${uid}号`;
        return {
          uid, name, themeId,
          scale: knownScales.has(String(p.scale)) ? String(p.scale) : 'standard',
          iter: normIter(p.iter),
          exposure: num(p.exposure, 0), // v16 起：设计期经营积累
          seeds: Math.floor(num(p.seeds, 0)),
          activities: { playtest: 0, promo: 0, diary: 0, ...(isRecord(p.activities) ? p.activities : {}) } as Record<string, number>,
          activityDay: num(p.activityDay, -1),
          activityCount: { playtest: 0, promo: 0, diary: 0, ...(isRecord(p.activityCount) ? p.activityCount : {}) } as Record<string, number>,
        };
      }).filter(p => knownThemes.has(p.themeId))
    : [];
  const normRarity = (raw: unknown, score: number): Rarity =>
    typeof raw === 'string' && ['N', 'R', 'SR', 'SSR'].includes(raw) ? raw as Rarity : rarityOf(score);
  const funded: FundedDesign[] = [];
  /** 旧条目缺 cost/delivered 的兜底：成本价无记录时按标准档重算（300×(0.8+Q/100)）；
   * 缺 commission/firstPayment/remainPayment 的旧数据视为已全额结算（remainPayment=income、delivered=true，保持旧交付行为） */
  const normFunded = (p: Record<string, unknown>, score: number, supporters: number, income: number): FundedDesign => {
    const costPrice = num(p.costPrice, Math.round(300 * (0.8 + score / 100)));
    const hasCost = typeof p.cost === 'number' && Number.isFinite(p.cost);
    const legacy = typeof p.commission !== 'number';
    const commission = Math.floor(num(p.commission, 0));
    const firstPayment = Math.floor(num(p.firstPayment, 0));
    return {
      uid: num(p.uid, 0),
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 10) : `设计·${num(p.uid, 0)}号`,
      score, rarity: normRarity(p.rarity, score),
      price: num(p.price, 0), supporters,
      cost: hasCost ? num(p.cost, 0) : supporters * costPrice,
      income,
      commission, firstPayment,
      remainPayment: legacy ? income : Math.floor(num(p.remainPayment, income - commission - firstPayment)),
      delivered: typeof p.delivered === 'boolean' ? p.delivered : true,
    };
  };
  // v1 旧字段 published → 并入 funded（支持者/收入信息已不存在，记 0；视为已结算）
  if (Array.isArray(desRaw.published)) {
    for (const p of desRaw.published.filter(isRecord)) {
      const score = Math.min(100, Math.max(1, Math.round(num(p.score, 1))));
      funded.push(normFunded(p, score, 0, 0));
    }
  }
  if (Array.isArray(desRaw.funded)) {
    for (const p of desRaw.funded.filter(isRecord)) {
      const score = Math.min(100, Math.max(1, Math.round(num(p.score, 1))));
      funded.push(normFunded(p, score, Math.floor(num(p.supporters, 0)), num(p.income, 0)));
    }
  }
  const knownPlatforms = new Set(PLATFORMS.map(p => p.id));
  const normPending = (raw: unknown): PendingEvent[] => Array.isArray(raw)
    ? raw.filter(isRecord)
        .map(e => ({ eventId: String(e.eventId ?? ''), remainingSec: num(e.remainingSec, 0) }))
        .filter(e => e.eventId && e.remainingSec > 0)
    : [];
  const normHistory = (raw: unknown): EventHistoryEntry[] => Array.isArray(raw)
    ? raw.filter(isRecord).map(h => ({
        day: Math.floor(num(h.day, 0)),
        eventId: String(h.eventId ?? ''),
        optionIdx: Math.floor(num(h.optionIdx, -1)),
        byDefault: h.byDefault === true,
        result: typeof h.result === 'string' ? h.result.slice(0, 60) : '',
        kind: h.kind === 'milestone' ? 'milestone' as const : 'event' as const,
      })).filter(h => h.eventId)
    : [];
  const campaigns: DesignCampaign[] = Array.isArray(desRaw.campaigns)
    ? desRaw.campaigns.filter(isRecord).map(c => {
        const score = Math.min(100, Math.max(1, Math.round(num(c.score, 1))));
        const days = Math.min(120, Math.max(1, Math.floor(num(c.days, 30))));
        const elapsedSec = num(c.elapsedSec, 0);
        return {
          uid: num(c.uid, 0),
          name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 10) : `设计·${num(c.uid, 0)}号`,
          themeId: knownThemes.has(String(c.themeId)) ? String(c.themeId) : THEMES[0].id,
          scale: knownScales.has(String(c.scale)) ? String(c.scale) : 'standard',
          score, rarity: normRarity(c.rarity, score),
          costPrice: num(c.costPrice, 0), price: num(c.price, 0),
          goal: Math.min(1000, Math.max(1, Math.floor(num(c.goal, 50)))),
          days,
          // v16 状态机：旧 campaign（无 status）视为已开众筹的 live，预热 0 天
          preheatDays: Math.min(days - 15 > 0 ? days - 15 : 0, Math.max(0, Math.floor(num(c.preheatDays, 0)))),
          platformId: knownPlatforms.has(String(c.platformId)) ? String(c.platformId) : 'moudian',
          status: c.status === 'preheat' ? 'preheat' as const : 'live' as const,
          watchers: Math.floor(num(c.watchers, 0)),
          exposure: num(c.exposure, 0),
          watchersDays: Math.max(0, Math.min(Math.floor(num(c.preheatDays, 0)), Math.floor(elapsedSec / 24))),
          convertRate: num(c.convertRate, 0),
          elapsedSec, supporters: Math.floor(num(c.supporters, 0)),
          flowMult: Math.max(1, num(c.flowMult, 1)),
          eventTimer: num(c.eventTimer, 0),
          usedEvents: Array.isArray(c.usedEvents) ? c.usedEvents.filter((id): id is string => typeof id === 'string') : [],
          pendingEvents: normPending(c.pendingEvents),
          eventHistory: normHistory(c.eventHistory),
          milestonesHit: Array.isArray(c.milestonesHit) ? c.milestonesHit.filter((m): m is number => typeof m === 'number') : [],
          boostCount: Math.floor(num(c.boostCount, 0)),
          iter: normIter(c.iter),
        };
      })
    : [];
  const failed: FailedCampaign[] = Array.isArray(desRaw.failed)
    ? desRaw.failed.filter(isRecord).map(c => ({
        uid: num(c.uid, 0),
        name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 10) : `设计·${num(c.uid, 0)}号`,
        goal: Math.min(1000, Math.max(1, Math.floor(num(c.goal, 50)))),
        days: Math.min(120, Math.max(1, Math.floor(num(c.days, 30)))),
        supporters: Math.floor(num(c.supporters, 0)),
      }))
    : [];
  const maxUid = Math.max(
    1,
    ...prototypes.map(p => p.uid + 1),
    ...campaigns.map(c => c.uid + 1),
    ...funded.map(p => p.uid + 1),
  );
  const designer: DesignerState = {
    unlocked: desRaw.unlocked === true,
    inspiration: num(desRaw.inspiration, 0),
    prototypes,
    campaigns,
    funded,
    failed,
    nextUid: Math.max(num(desRaw.nextUid, 1), maxUid),
    successCount: Math.max(num(desRaw.successCount, 0), funded.length),
  };
  return {
    ...s,
    ...data,
    saveVersion: SAVE_VERSION,
    prestige: {
      insight: num(presRaw.insight, 0),
      perks,
      runs: Math.floor(num(presRaw.runs, 0)),
      lastGain: num(presRaw.lastGain, 0),
      coins: num(presRaw.coins, 0),
      shop,
      challengeDone,
      pendingChallenge,
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
    challenge: { active, progress: active ? num(chRaw.progress, 0) : 0 },
    designer,
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
      xyEarned: num(stats.xyEarned, 0),
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
      quickListPct: (() => {
        const v = num(isRecord(data.settings) ? data.settings.quickListPct : undefined, 100);
        return Math.min(200, Math.max(50, Math.round(v / 5) * 5));
      })(),
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
