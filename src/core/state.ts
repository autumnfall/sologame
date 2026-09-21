import { ATTRS, SAVE_VERSION } from './data/constants';
import type { Attr } from './data/constants';

/** 收藏级属性：一款桌游的「账号进度」，与实体无关，卖光重买依然保留 */
export interface CollectionEntry {
  /** 是否已获一次性开箱奖励（原型的 owned.count>0 语义） */
  firstOpened: boolean;
  /** 熟练度：已玩局数（仅游玩 +1） */
  prof: number;
  /** 疲劳：float 累计（页面不显示数值）；游玩目标 +2/其余 -1，收益 = 1/(1+疲劳×0.15)，≥7「玩腻了」 */
  fatigue: number;
  /** 规则已读（跳过读规则阶段） */
  rulesRead: boolean;
  /** 唯一副本卖光过（回头客成就用：再次 acquire 时触发） */
  resold?: boolean;
}

/** 桌游实体：每个副本有自己的成色/牌套/收纳 */
export interface Copy {
  uid: number;
  gameId: string;
  /** 当前耐久（牌套磨损减半会产生 .5 小数），0 可玩但收益 ×0.5 */
  durability: number;
  sleeved: boolean;
  stored: boolean;
  /** 收藏架锁定：锁定的实体不可出售（含一键上架磨光件） */
  locked?: boolean;
}

/** 离线期间单款桌游的自动游玩统计 */
export interface OfflinePlayStat {
  gameId: string;
  /** 游玩局数（= 熟练度增量） */
  rounds: number;
  /** 耐久磨损合计 */
  wear: number;
}

/**
 * 离线总结（收益已自动入账，这里只存展示数据）：
 * 超过 1 分钟的离线会在回来时弹出总结弹窗，随后清空。
 */
export interface OfflineBank {
  /** 累计离线毫秒 */
  t: number;
  workMoney: number;
  workCycles: number;
  /** 离线自动游玩的局数（游玩只积累经验，不产生金钱） */
  playRounds: number;
  /** 六维经验增量 */
  exp: Partial<Record<Attr, number>>;
  games: OfflinePlayStat[];
}

/** 某鱼在售货源（一件 = 一个实体）；blind = 一口价盲买：UI 只显示名称，隐藏成色/牌套/收纳 */
export interface MarketItem {
  gameId: string;
  price: number;
  durability: number;
  sleeved: boolean;
  stored: boolean;
  blind?: boolean;
}

/** 某鱼出售上架：引用实体 uid（实体在此期间不可游玩/再上架） */
export interface Listing {
  copyUid: number;
  price: number;
}

/** 转生「退坑」：跨周目保留的元进度 */
export interface PrestigeState {
  /** 桌游阅历（转生货币） */
  insight: number;
  /** 天赋：id -> 等级 */
  perks: Record<string, number>;
  /** 已完成周目数 */
  runs: number;
  /** 上周目获得的阅历（保底递增用） */
  lastGain: number;
  /** 挑战币（完成挑战一次性获得，跨周目保留） */
  coins: number;
  /** 挑战商店等级：id -> 等级 */
  shop: Record<string, number>;
  /** 已完成（领过币）的挑战 id，一次性奖励的依据 */
  challengeDone: string[];
  /** 下次开周目时生效的挑战（转生确认弹窗中选择；开新周目时被消费转为 challenge.active） */
  pendingChallenge: string | null;
}

/** 一个已完成周目的成绩记录（本地榜与在线榜共用结构） */
export interface RunRecord {
  /** 玩家填写的名称 */
  name: string;
  /** 本周目耗时（真实毫秒，从开局到点转生） */
  ms: number;
  /** 完成时的周目数 */
  runs: number;
  /** 完成时的总计阅历 */
  insight: number;
  /** 完成时的总计成就数 */
  achievements: number;
  /** 本周目精通的桌游数量（转生瞬间的精通数） */
  mastered: number;
  /** 完成时间戳 */
  at: number;
  /** 客户端唯一 id（在线榜按此去重，取最好成绩） */
  clientId?: string;
}

/** 游戏存档 */
export interface GameState {
  saveVersion: number;
  prestige: PrestigeState;
  money: number;
  /** 牌套（张） */
  sleeves: number;
  /** 某赏普通券 */
  tickets: number;
  /** 某赏高级券（普通券+50牌套兑换） */
  hiTickets: number;
  /** 六维属性经验 */
  attrExp: Record<Attr, number>;
  /** 收藏：id -> 收藏级进度 */
  collections: Record<string, CollectionEntry>;
  /** 全部实体（含上架中的） */
  copies: Copy[];
  /** 下一个实体 uid（自增） */
  nextUid: number;
  /** 某宝剩余库存：id -> 剩余可购次数 */
  taobaoStock: Record<string, number>;
  /** 某鱼在售货源 */
  xianyuBuys: MarketItem[];
  /** 某鱼出售上架 */
  listings: Listing[];
  /** 出售槽位数（1~5，可花钱扩充） */
  sellSlots: number;
  /** 市场每次刷新商品数（3~7，可花钱扩充） */
  marketSlots: number;
  /** 下次某鱼自动到货时间戳 */
  xyNext: number;
  /** 下次挂售成交判定时间戳（每 30s，与到货刷新独立） */
  xySellNext: number;
  /** 某赏常驻池 SSR 保底进度 */
  pity: number;
  /** 某赏轮换池 SSR 保底进度（独立） */
  pityRot: number;
  /** 轮换赏池主题属性；null = 尚未开池 */
  rotTheme: Attr | null;
  /** 下次轮换时间戳 */
  rotNext: number;
  /** 当前职业 id */
  job: string | null;
  /** 当前工作周期已推进的秒数（换工作清零） */
  jobProgress: number;
  /** 是否已完成开局三选一 */
  started: boolean;
  /** 挑战场景（周目级）：当前激活的挑战 id 与目标进度 */
  challenge: { active: string | null; progress: number };
  /** 离线总结（收益已自动入账；>1 分钟离线回来时弹窗展示，关闭后清空） */
  offlineBank: OfflineBank;
  lastSeen: number;
  /** 生涯统计（含成就用事件计数器） */
  stats: {
    plays: number;
    pulls: number;
    /** 完成的工作周期数（在线 + 离线） */
    workCycles: number;
    /** 某鱼挂售成交次数 */
    soldCount: number;
    /** 某宝 / 某鱼购买次数 */
    tbBought: number;
    xyBought: number;
    /** 触发保底次数 / 200% 定价成交次数 / 捡漏次数 */
    pityHits: number;
    highPriceSold: number;
    bargainBuys: number;
    /** 某鱼卖出净额累计（成交价 − 手续费；挑战「无薪挑战」目标） */
    xyEarned: number;
    /** 回头客：唯一副本卖光后重新入手 */
    comeback: boolean;
    respecCount: number;
  };
  /** 已达成成就 id 列表（每个 +1% 全局经验） */
  achievements: string[];
  /** 玩家名称（排行榜展示用，可留空） */
  playerName: string;
  /** 本周目开始时间戳（转生重置为当前时间） */
  runStartedAt: number;
  /** 本地排行榜：耗时最小的 10 个已完成周目 */
  localBoard: RunRecord[];
  /** 客户端唯一 id（在线榜去重用，首次生成后永久保留） */
  clientId: string;
  /** 功能性设置 */
  settings: {
    /** 连刷自动更换：关 / 疲劳后换 / 精通后换（两档互斥） */
    autoSwitch: 'off' | 'fatigue' | 'mastery';
    /** 某鱼快速上架（成就 30 个解锁）：开启后收藏架点「某鱼上架」直接按行情价上架，不跳转 */
    quickList: boolean;
    /** 快速上架比例（行情价百分比，50~200，默认 100） */
    quickListPct: number;
  };
}

export function emptyOfflineBank(): OfflineBank {
  return { t: 0, workMoney: 0, workCycles: 0, playRounds: 0, exp: {}, games: [] };
}

export function defaultPrestige(): PrestigeState {
  return { insight: 0, perks: {}, runs: 0, lastGain: 0, coins: 0, shop: {}, challengeDone: [], pendingChallenge: null };
}

export function defaultState(): GameState {
  return {
    saveVersion: SAVE_VERSION,
    prestige: defaultPrestige(),
    money: 200,
    sleeves: 100,
    tickets: 0,
    hiTickets: 0,
    attrExp: Object.fromEntries(ATTRS.map(a => [a, 0])) as Record<Attr, number>,
    collections: {},
    copies: [],
    nextUid: 1,
    taobaoStock: {},
    xianyuBuys: [],
    listings: [],
    sellSlots: 1,
    marketSlots: 3,
    xyNext: 0,
    xySellNext: 0,
    pity: 0,
    pityRot: 0,
    rotTheme: null,
    rotNext: 0,
    job: null,
    jobProgress: 0,
    started: false,
    challenge: { active: null, progress: 0 },
    offlineBank: emptyOfflineBank(),
    lastSeen: Date.now(),
    stats: {
      plays: 0, pulls: 0, workCycles: 0, soldCount: 0, tbBought: 0, xyBought: 0,
      pityHits: 0, highPriceSold: 0, bargainBuys: 0, xyEarned: 0, comeback: false, respecCount: 0,
    },
    achievements: [],
    playerName: '',
    runStartedAt: Date.now(),
    localBoard: [],
    clientId: genClientId(),
    settings: { autoSwitch: 'off', quickList: false, quickListPct: 100 },
  };
}

/** 生成客户端唯一 id（在线排行榜按此去重） */
export function genClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 查找实体 */
export function copyByUid(state: GameState, uid: number): Copy | undefined {
  return state.copies.find(c => c.uid === uid);
}

/** 某收藏当前可用实体（未上架的） */
export function copiesOf(state: GameState, gameId: string): Copy[] {
  const listed = new Set(state.listings.map(l => l.copyUid));
  return state.copies.filter(c => c.gameId === gameId && !listed.has(c.uid));
}
