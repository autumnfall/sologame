import type { Attr } from './constants';
import type { Rarity } from './types';

// ================= 桌游设计师（v4：众筹系统）调参区 =================
// 核心循环：游玩获得灵感 → 立项（名称+类型+体量）→ 六维迭代打磨出 Q → 发起众筹 → 逐秒需求模拟 → 到期结算。
// 出版玩法明确不做（successCount ≥ 10 后预留）。挑战商店设计线消费：insp-up（灵感）/ score-up（Q）/ royalty-up（众筹购买概率 +6%/级）。

/** 设计主题：mainAttr 为「主场维度」（该维度迭代增益 +1） */
export interface DesignTheme {
  id: string;
  name: string;
  mainAttr: Attr;
  desc: string;
}

/** 8 个主题覆盖六维（沉浸/洞察各复用一次） */
export const THEMES: readonly DesignTheme[] = [
  { id: 'euro', name: '德式精算', mainAttr: '演算', desc: '烧脑算分德式，考验精密规划' },
  { id: 'ameritrash', name: '美式史诗', mainAttr: '沉浸', desc: '剧情驱动的史诗冒险' },
  { id: 'party', name: '聚会嗨皮', mainAttr: '应变', desc: '气氛担当，欢乐互坑' },
  { id: 'mystery', name: '推理悬疑', mainAttr: '洞察', desc: '抽丝剥茧，真相只有一个' },
  { id: 'wargame', name: '战棋沙盘', mainAttr: '谋略', desc: '排兵布阵，决胜千里' },
  { id: 'dbg', name: '卡牌构筑', mainAttr: '运筹', desc: '组牌连招，一回合爆发' },
  { id: 'family', name: '亲子同乐', mainAttr: '沉浸', desc: '轻松上手，全家同桌' },
  { id: 'solo', name: '单人冥想', mainAttr: '洞察', desc: '一个人的沉浸式解谜' },
];

const THEME_MAP = new Map(THEMES.map(t => [t.id, t]));

export function themeById(id: string): DesignTheme {
  const t = THEME_MAP.get(id);
  if (!t) throw new Error(`未知主题 id: ${id}`);
  return t;
}

/** 设计维度：与六维属性一一对应（属性等级只提供增益，永不消耗） */
export interface DesignDim {
  key: string;
  name: string;
  attr: Attr;
}

export const DESIGN_DIMS: readonly DesignDim[] = [
  { key: 'mech', name: '机制深度', attr: '谋略' },
  { key: 'balance', name: '数值平衡', attr: '演算' },
  { key: 'replay', name: '重开变化', attr: '应变' },
  { key: 'art', name: '组件美工', attr: '洞察' },
  { key: 'rules', name: '规则条理', attr: '运筹' },
  { key: 'theme', name: '主题沉浸', attr: '沉浸' },
];

const DIM_MAP = new Map(DESIGN_DIMS.map(d => [d.key, d]));

export function dimByKey(key: string): DesignDim {
  const d = DIM_MAP.get(key);
  if (!d) throw new Error(`未知维度 key: ${key}`);
  return d;
}

/** 主题主场维度 key（mainAttr 对应的维度，迭代增益 +1） */
export function themeDimKey(theme: DesignTheme): string {
  return DESIGN_DIMS.find(d => d.attr === theme.mainAttr)!.key;
}

/** 体量三档：决定成本价基数与牌套需求 */
export interface DesignScale {
  id: string;
  name: string;
  /** 成本价基数 */
  costBase: number;
  /** 牌套需求（给该桌游套牌套的花费） */
  sleeveCost: number;
}

export const SCALES: readonly DesignScale[] = [
  { id: 'small', name: '小盒', costBase: 120, sleeveCost: 50 },
  { id: 'standard', name: '标准', costBase: 300, sleeveCost: 150 },
  { id: 'big', name: '大盒', costBase: 600, sleeveCost: 300 },
];

const SCALE_MAP = new Map(SCALES.map(s => [s.id, s]));

export function scaleById(id: string): DesignScale {
  const s = SCALE_MAP.get(id);
  if (!s) throw new Error(`未知体量 id: ${id}`);
  return s;
}

// ---------- 数值定稿（docs/challenges-designer.md 同步） ----------

/** 游玩灵感：按稀有度 N+1 / R+2 / SR+4 / SSR+8（隐藏款 ×2），乘 insp-up；cap 999 */
export const INSPIRE_BY_RARITY: Record<Rarity, number> = { N: 1, R: 2, SR: 4, SSR: 8 };
export const INSPIRE_HIDDEN_MULT = 2;
export const INSPIRE_CAP = 999;

/** 立项花费灵感 */
export const FOUND_COST = 10;

/** 迭代：每维上限 5 次；第 n 次花 5n 灵感；单次增益 = 2 + floor(0.4×属性等级) + 主场 +1 */
export const ITER_MAX = 5;
export function iterCost(n: number): number {
  return 5 * n;
}
export function iterGain(level: number, isHome: boolean): number {
  return 2 + Math.floor(0.4 * level) + (isHome ? 1 : 0);
}

/** 质量分 Q = clamp(1,100, round((30 + Σ迭代×增益) × (1+0.08×scoreUp))) */
export const Q_BASE = 30;
/** 稀有度阈值（只影响众筹需求概率）：Q<50 N / <70 R / <90 SR / ≥90 SSR */
export const RARITY_THRESHOLDS: readonly { min: number; rarity: Rarity }[] = [
  { min: 90, rarity: 'SSR' },
  { min: 70, rarity: 'SR' },
  { min: 50, rarity: 'R' },
  { min: 0, rarity: 'N' },
];

/** Q → 稀有度 */
export function rarityOf(q: number): Rarity {
  for (const t of RARITY_THRESHOLDS) if (q >= t.min) return t.rarity;
  return 'N';
}

/** 众筹需求概率：稀有度加成 */
export const RARITY_DEMAND_BONUS: Record<Rarity, number> = { N: 0, R: 0.05, SR: 0.10, SSR: 0.20 };

/** 众筹参数范围与节奏 */
export const CROWD_GOAL_MIN = 50;
export const CROWD_GOAL_MAX = 1000;
export const CROWD_DAYS_MIN = 30;
export const CROWD_DAYS_MAX = 120;
/** 1 天 = 现实 24 秒 */
export const DAY_SECONDS = 24;
/** 众筹成功作品达此数后预留出版玩法（当前版本拒绝再发起） */
export const CROWD_SUCCESS_LIMIT = 10;

/** 成本价 = round(体量基数 × (0.8+Q/100))；玩家定价 = 成本价 × 100%~1000% */
export const PRICE_RATIO_MIN = 1;
export const PRICE_RATIO_MAX = 10;

/** 自创实体耐久上限（复用 SSR 档，出售成色按 SSR 计） */
export const DESIGN_DURABILITY = 80;
