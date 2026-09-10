import { ATTRS, SAVE_VERSION } from './data/constants';
import type { Attr } from './data/constants';

/** 单款桌游的收藏状态 */
export interface OwnedGame {
  /** 拥有盒数（原型期每款最多 1） */
  count: number;
  /** 熟练度：已玩局数（某赏重复可叠加） */
  prof: number;
  /** 疲劳：该盒 +2 / 其余 -1，收益 = 1/(1+疲劳×0.15)，≥7 显示「玩腻了」 */
  fatigue: number;
  /** 已套牌套（游玩时长 ×0.85） */
  sleeved: boolean;
  /** 已收纳（Setup ×0.5） */
  stored: boolean;
  /** 规则已读（跳过读规则阶段） */
  rulesRead: boolean;
}

/** 某鱼货架上的一件货源 */
export interface XianyuItem {
  id: string;
  price: number;
}

/** 游戏存档（对应原型 localStorage 中的 JSON） */
export interface GameState {
  saveVersion: number;
  money: number;
  /** 牌套（张） */
  sleeves: number;
  /** 某赏抽赏券 */
  tickets: number;
  /** 六维属性经验 */
  attrExp: Record<Attr, number>;
  /** 收藏：id -> 状态 */
  owned: Record<string, OwnedGame>;
  /** 某宝库存：id -> 剩余 */
  taobaoStock: Record<string, number>;
  xianyu: XianyuItem[];
  /** 下次某鱼自动到货时间戳 */
  xyNext: number;
  /** 某赏 SSR 保底进度 */
  pity: number;
  /** 当前职业 id */
  job: string | null;
  /** 是否已完成开局三选一 */
  started: boolean;
  /** 离线收益待领取 */
  offlineBank: { t: number; money: number; log: string[] };
  lastSeen: number;
  stats: { plays: number; pulls: number };
}

export function defaultState(): GameState {
  return {
    saveVersion: SAVE_VERSION,
    money: 200,
    sleeves: 100,
    tickets: 0,
    attrExp: Object.fromEntries(ATTRS.map(a => [a, 0])) as Record<Attr, number>,
    owned: {},
    taobaoStock: {},
    xianyu: [],
    xyNext: 0,
    pity: 0,
    job: null,
    started: false,
    offlineBank: { t: 0, money: 0, log: [] },
    lastSeen: Date.now(),
    stats: { plays: 0, pulls: 0 },
  };
}
