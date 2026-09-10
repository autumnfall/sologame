import type { Rarity } from './types';

// ---------- 全局常量（数值平衡的唯一来源） ----------

/**
 * 存档版本；变更存档结构时必须 +1 并在 engine/save.ts 的 MIGRATIONS 里补迁移函数。
 * v3 = 原型最终版；v4 = 正式版（去掉死字段 attrs）；
 * v5 = 收藏/实体分离（owned→collections+copies、某鱼市场、某宝多次购买、某赏轮换池）；
 * v6 = 职业改周期制（rate→cycleSec/cyclePay、jobProgress；旧 clerk/editor/designer 映射新职业）；
 * v7 = 转生系统（新增 prestige：阅历/天赋/周目数）。
 */
export const SAVE_VERSION = 7;
export const SAVE_KEY = 'bgcollector_save';

/** 离线收益累积上限：1 小时 */
export const OFFLINE_CAP_MS = 3600 * 1000;
/** 单次游玩游戏内时长上限（分钟） */
export const PLAY_CAP_MIN = 60;

/** 每多一种桌游，全属性经验 +1.5%（软上限 +50%） */
export const GLOBAL_PER_KIND = 0.015;
export const GLOBAL_SOFTCAP = 0.50;

/** 疲劳软上限（超过后收益惩罚不再加重） */
export const FATIGUE_SOFTCAP = 10;

/** 某赏 50 抽硬保底 SR 及以上（SR/SSR 按 3:1 掷） */
export const GACHA_PITY = 50;

/** 某鱼每 5 分钟自动刷新一批货源 */
export const XY_REFRESH_MS = 5 * 60 * 1000;

// ---------- 六维属性 ----------

export const ATTRS = ['谋略', '演算', '应变', '运筹', '洞察', '沉浸'] as const;
export type Attr = (typeof ATTRS)[number];

export const ATTR_ICON: Record<Attr, string> = {
  谋略: '🧠', 演算: '📐', 应变: '🎲', 运筹: '🧰', 洞察: '🔍', 沉浸: '📖',
};

/** 六维属性效果说明（教程/悬浮提示共用，全部为乘区） */
export const ATTR_EFFECT: Record<Attr, string> = {
  谋略: '每级使游玩经验 +2.5%（相乘）',
  演算: '每级使游玩时间 -2%（相乘，下限 ×0.80）',
  应变: '每级使游玩疲劳增长 -4%（相乘，下限 ×0.60）',
  运筹: '每级使某鱼购物价格 -2%（下限 ×0.80）、成交手续费 -0.5%（10 级全免）',
  洞察: '每级使抽赏券掉落率 +10%，时机条金色区宽度 +2%（上限 40%）',
  沉浸: '每级使游玩收入 +4%（相乘），并提高主播带货的酬劳下限',
};

/** 每局属性经验分配比例（按游戏属性个数）：主属性占大头 */
export const EXP_SHARES: Readonly<Record<number, readonly number[]>> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
  4: [0.4, 0.3, 0.2, 0.1],
  6: [0.2, 0.2, 0.15, 0.15, 0.15, 0.15],
};

export const ROMAN = ['0', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'] as const;

// ---------- 稀有度阶梯 ----------

/** 集齐某级全部常规款 → 解锁下一级某宝购买（隐藏款不计入） */
export const TIER_ORDER: readonly Rarity[] = ['N', 'R', 'SR', 'SSR'];

/** 开箱一次性属性奖励（首次入手新桌游） */
export const FIRST_BONUS: Record<Rarity, number> = { N: 15, R: 30, SR: 60, SSR: 120 };

/** 精通门槛：同一款游玩达 N20 / R40 / SR80 / SSR160 局后基础时长再减半 */
export const MASTERY: Record<Rarity, number> = { N: 20, R: 40, SR: 80, SSR: 160 };

/** 1 包牌套 = 50 张 */
export const SLEEVE_PACK = 50;
