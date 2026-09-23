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

/** 灵感获取只看游玩时长（游戏分钟）：base = max(1, round(playTime/30))，最终 min(5, round(base × insp-up)) */
export const INSPIRE_MINUTES_DIV = 30;
export const INSPIRE_MAX_PER_PLAY = 5;

/** 灵感动态上限 = 基础 100 + 每款已精通桌游按稀有度追加（N1/R2/SR3/SR4，每款只算一次） */
export const INSPIRE_BASE_CAP = 100;
export const INSPIRE_CAP_BY_RARITY: Record<Rarity, number> = { N: 1, R: 2, SR: 3, SSR: 4 };

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

// ---------- v5：曝光 · 预热 · 平台 · 事件（docs/designer-v5-crowdfund.md 定稿） ----------

/** 曝光软上限：超出部分收益减半 */
export const EXPOSURE_SOFTCAP = 200;

/** 众筹平台：抽成 + 预热基础曝光（发起时选定，不可更换） */
export interface CrowdPlatform {
  id: string;
  name: string;
  /** 总成交额抽成率 */
  commission: number;
  /** 预热每日基础曝光 */
  baseExposure: number;
  desc: string;
}

export const PLATFORMS: readonly CrowdPlatform[] = [
  { id: 'moudian', name: '某点', commission: 0.05, baseExposure: 25, desc: '流量大、到手少' },
  { id: 'xinwu', name: '某集', commission: 0.03, baseExposure: 12, desc: '精准、到手多' },
];

const PLATFORM_MAP = new Map(PLATFORMS.map(p => [p.id, p]));

export function platformById(id: string): CrowdPlatform {
  const p = PLATFORM_MAP.get(id);
  if (!p) throw new Error(`未知平台 id: ${id}`);
  return p;
}

/** 设计期经营 activity key */
export type ActivityKey = 'playtest' | 'promo' | 'diary';

/** 经营：试玩与宣传每日各上限（1 天 = 游戏时间 24 秒）；设计日记由灵感自然限制 */
export const ACTIVITY_DAILY_LIMIT = 3;

/** 组织试玩成本 ¥50×2ⁿ（n = 已办次数） */
export function playtestCost(n: number): number {
  return 50 * Math.pow(2, n);
}

/** 社媒宣传成本 ¥30×1.6ⁿ（四舍五入） */
export function promoCost(n: number): number {
  return Math.round(30 * Math.pow(1.6, n));
}

/** 设计日记：灵感 3 → 曝光 +4 */
export const DIARY_INSPIRATION_COST = 3;
export const DIARY_EXPOSURE = 4;

/** 组织试玩产出：曝光 +8~15、看好种子 +0~3；沉浸/应变每级 +4% 产出 */
export const PLAYTEST_EXPOSURE_RANGE: readonly [number, number] = [8, 15];
export const PLAYTEST_SEED_RANGE: readonly [number, number] = [0, 3];
export const PLAYTEST_ATTR_BONUS = 0.04;

/** 社媒宣传产出：曝光 +5~10（纯花钱买量） */
export const PROMO_EXPOSURE_RANGE: readonly [number, number] = [5, 10];

/** 预热追加宣传（预热期内花金钱买曝光，按剩余天数折算看好）——成本曲线沿用社媒宣传 */
export const BOOST_EXPOSURE_RANGE: readonly [number, number] = [5, 10];

/** 时间池：总期限 T ∈ [30,120]，预热 P ∈ [5, min(30, T−15)]（众筹至少留 15 天） */
export const PREHEAT_MIN = 5;

/** 预热最长天数（随总时长收缩） */
export function preheatMax(totalDays: number): number {
  return Math.min(30, totalDays - 15);
}

/** 每日新增看好 = round((曝光/10 + 平台基础曝光) × 定价亲和 × 质量系数) */
export function priceAffinity(ratio: number): number {
  const r = Math.min(PRICE_RATIO_MAX, Math.max(PRICE_RATIO_MIN, ratio));
  return 1.2 - (r - 1) * (0.6 / 9); // 100%→1.2，1000%→0.6，线性
}

export function qualityMult(q: number): number {
  return 0.8 + 0.004 * q; // Q100 = 1.2
}

/** 看好 → 初始支持转化率 = 15% + min(15%, Q/10×1%) − (定价倍率−1)×2%，下限 5% */
export function convertRate(q: number, ratio: number): number {
  const r = Math.min(PRICE_RATIO_MAX, Math.max(PRICE_RATIO_MIN, ratio));
  return Math.max(0.05, 0.15 + Math.min(0.15, (q / 10) * 0.01) - (r - 1) * 0.02);
}

// ---------- 事件系统 ----------

/** 每 5 天（120 秒）判定一次，60% 概率生成；事件独立 5 天倒计时 */
export const EVENT_CHECK_SECONDS = 5 * DAY_SECONDS;
export const EVENT_CHANCE = 0.6;
export const EVENT_WINDOW_SECONDS = 5 * DAY_SECONDS;
/** 进入众筹最后 5 天：所有待决事件自动按默认结算 */
export const EVENT_FINAL_DAYS = 5;

/** 事件选项：需求（属性门槛 / 成交额百分比 / 灵感）与结果（支持 ±% 或 剩余天数流量乘区） */
export interface EventOptionDef {
  label: string;
  /** 成交额百分比（按当前 supporters×price 取整） */
  moneyPct?: number;
  /** 属性门槛（单属性） */
  requireAttr?: { attr: Attr; lv: number };
  /** 属性门槛（二选一） */
  requireAttrAlt?: { attrs: [Attr, Attr]; lv: number };
  /** 灵感花费 */
  inspiration?: number;
  /** 结果：支持者 ±%（按当前人数取整，不扣到 0 以下） */
  supportersPct?: number;
  /** 结果：剩余天数每秒流量乘区 +25%~+50%（flowMult ×= 1+bonus） */
  flowBonus?: number;
  /** 50% 概率命中才有 flowBonus（事件3竞拍），落空不退款 */
  flowGamble?: boolean;
  isDefault?: boolean;
}

export interface EventDef {
  id: string;
  name: string;
  options: readonly EventOptionDef[];
}

/** 事件池（定稿 16 个，★ = 默认选项：不耗资源、结果中性或负面） */
export const EVENT_POOL: readonly EventDef[] = [
  { id: 'e1', name: 'KOL 直播带货邀约', options: [
    { label: '付费推广（成交额 3%）', moneyPct: 0.03, supportersPct: 0.08 },
    { label: '送样品免费合作', supportersPct: 0.03 },
    { label: '婉拒', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e2', name: '商场快闪试玩爆火', options: [
    { label: '加开一场（成交额 4%）', moneyPct: 0.04, supportersPct: 0.10 },
    { label: '灵活加场只花一半（应变≥10）', requireAttr: { attr: '应变', lv: 10 }, moneyPct: 0.02, supportersPct: 0.10 },
    { label: '维持原计划', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e3', name: '平台首页推荐位竞拍', options: [
    { label: '出价（成交额 6%，50% 命中，落空不退）', moneyPct: 0.06, flowBonus: 0.50, flowGamble: true },
    { label: '放弃', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e4', name: '工厂跳票传言发酵', options: [
    { label: '花钱公关（成交额 5%）', moneyPct: 0.05, supportersPct: 0 },
    { label: '晒生产排期自证（运筹≥12）', requireAttr: { attr: '运筹', lv: 12 }, supportersPct: 0.02 },
    { label: '不理', supportersPct: -0.08, isDefault: true },
  ] },
  { id: 'e5', name: '恶意差评刷屏', options: [
    { label: '取证举报（洞察≥12）', requireAttr: { attr: '洞察', lv: 12 }, supportersPct: 0.04 },
    { label: '花钱控评（成交额 4%）', moneyPct: 0.04, supportersPct: 0 },
    { label: '躺平', supportersPct: -0.07, isDefault: true },
  ] },
  { id: 'e6', name: '物流临时涨价', options: [
    { label: '自担成本（成交额 3%）', moneyPct: 0.03, supportersPct: 0 },
    { label: '重算方案摊平（演算≥12）', requireAttr: { attr: '演算', lv: 12 }, supportersPct: -0.01 },
    { label: '转嫁给买家', supportersPct: -0.05, isDefault: true },
  ] },
  { id: 'e7', name: '核心玩家质疑规则漏洞', options: [
    { label: '公开 FAQ+修订（谋略≥10 或 演算≥10）', requireAttrAlt: { attrs: ['谋略', '演算'], lv: 10 }, supportersPct: 0.05 },
    { label: '请规则顾问（成交额 4%）', moneyPct: 0.04, supportersPct: 0.01 },
    { label: '嘴硬硬扛', supportersPct: -0.06, isDefault: true },
  ] },
  { id: 'e8', name: '行业媒体专访邀约', options: [
    { label: '讲出好故事（沉浸≥10）', requireAttr: { attr: '沉浸', lv: 10 }, supportersPct: 0.06 },
    { label: '普通受访', supportersPct: 0.02 },
    { label: '婉拒', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e9', name: '社区催更解锁项', options: [
    { label: '连夜设计新解锁（应变≥10）', requireAttr: { attr: '应变', lv: 10 }, supportersPct: 0.07 },
    { label: '敷衍回应', supportersPct: -0.03 },
    { label: '不承诺', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e10', name: '盗版扫描件流出', options: [
    { label: '溯源+法务函（洞察≥15）', requireAttr: { attr: '洞察', lv: 15 }, supportersPct: 0.03 },
    { label: '花钱下架（成交额 5%）', moneyPct: 0.05, supportersPct: 0 },
    { label: '不管', supportersPct: -0.06, isDefault: true },
  ] },
  { id: 'e11', name: '玩家要求加签名档', options: [
    { label: '答应（灵感 5）', inspiration: 5, supportersPct: 0.05 },
    { label: '拒绝', supportersPct: -0.04, isDefault: true },
  ] },
  { id: 'e12', name: '潮牌联动提案', options: [
    { label: '深度合作（沉浸≥8，成交额 2%）', requireAttr: { attr: '沉浸', lv: 8 }, moneyPct: 0.02, supportersPct: 0.08 },
    { label: '贴牌授权（成交额 1%）', moneyPct: 0.01, supportersPct: 0.03 },
    { label: '拒绝', supportersPct: 0, isDefault: true },
  ] },
  { id: 'e13', name: '撞车大作发售日', options: [
    { label: '改期预热收尾冲榜（应变≥12）', requireAttr: { attr: '应变', lv: 12 }, supportersPct: 0.04 },
    { label: '硬刚', supportersPct: -0.05, isDefault: true },
    { label: '加码宣传（成交额 3%）', moneyPct: 0.03, supportersPct: 0 },
  ] },
  { id: 'e14', name: '早期支持者晒单裂变', options: [
    { label: '转发抽奖（灵感 3）', inspiration: 3, supportersPct: 0.06 },
    { label: '仅感谢', supportersPct: 0.01, isDefault: true },
  ] },
  { id: 'e15', name: '大 V 锐评「年度黑马」', options: [
    { label: '收下赞誉（默认）', supportersPct: 0.05, flowBonus: 0.25, isDefault: true },
  ] },
  { id: 'e16', name: '平台服务器宕机半小时', options: [
    { label: '补偿优惠券（成交额 1%）', moneyPct: 0.01, supportersPct: 0 },
    { label: '不补偿', supportersPct: -0.03, isDefault: true },
  ] },
];

const EVENT_MAP = new Map(EVENT_POOL.map(e => [e.id, e]));

export function eventById(id: string): EventDef {
  const e = EVENT_MAP.get(id);
  if (!e) throw new Error(`未知事件 id: ${id}`);
  return e;
}

/** 里程碑解锁：达到目标 150%/200% 自动 +3%/+5% 支持 */
export const MILESTONES: readonly { pct: number; bonus: number }[] = [
  { pct: 1.5, bonus: 0.03 },
  { pct: 2.0, bonus: 0.05 },
];

/** 两阶段结算：到期立即到账 50%×(货款−抽成)，交付时收回剩余 50%×(货款−抽成) */
export const FIRST_PAYMENT_RATIO = 0.5;
