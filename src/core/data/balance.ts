import type { Rarity } from './types';

// ================= 平衡调参区 =================
// 所有新玩法的可调数值集中于此，调平衡只改这里（★ 均为占位初值）。

/** 满耐久（≈可玩次数），按稀有度 */
export const DURABILITY: Record<Rarity, number> = { N: 10, R: 20, SR: 40, SSR: 80 };

/** 收纳为一次性整理：做收纳时按稀有度一次性扣除的耐久 */
export const STORE_WEAR_ONCE: Record<Rarity, number> = { N: 1, R: 2, SR: 3, SSR: 4 };

/** 收纳完成后，该实体每次游玩的耐久磨损倍率（减缓 25%） */
export const STORE_WEAR_MULT = 0.75;

/** 耐久为 0 时整体收益（经验+收入）倍率 */
export const WORN_PENALTY = 0.5;

/** 某宝每款可购次数（售完不补） */
export const TAOBAO_STOCK: Record<Rarity, number> = { N: 4, R: 3, SR: 2, SSR: 1 };

/**
 * 某赏奖池（常驻/轮换统一）：累加判定，顺序即优先级。
 * 牌套 4/10/20 包 = 30/15/5%；桌游 N/R/SR/SSR = 30/15/4/1%。
 */
export const GACHA_TABLE: readonly (
  | { kind: 'sleeves'; packs: number; p: number }
  | { kind: 'game'; rarity: Rarity; p: number }
)[] = [
  { kind: 'sleeves', packs: 4, p: 0.30 },
  { kind: 'sleeves', packs: 10, p: 0.15 },
  { kind: 'sleeves', packs: 20, p: 0.05 },
  { kind: 'game', rarity: 'N', p: 0.30 },
  { kind: 'game', rarity: 'R', p: 0.15 },
  { kind: 'game', rarity: 'SR', p: 0.04 },
  { kind: 'game', rarity: 'SSR', p: 0.01 },
];

/** 保底触发时 SR/SSR 的比例（与基础 3:1 一致） */
export const GACHA_PITY_SSR_SHARE = 0.25;

/** 桌游池（原轮换池）奖池：仅桌游，N60 / R30 / SR8 / SSR2 */
export const GAME_POOL_TABLE: readonly { rarity: Rarity; p: number }[] = [
  { rarity: 'N', p: 0.60 },
  { rarity: 'R', p: 0.30 },
  { rarity: 'SR', p: 0.08 },
  { rarity: 'SSR', p: 0.02 },
];

/** 桌游池：周期与单抽价（金钱） */
export const ROTATION_MS = 10 * 60 * 1000;
export const ROTATION_PRICE = 200;

/** 精通池：单抽固定 200 张牌套；熟练奖励 N5/R10/SR20/SSR40；抽中稀有度全部已精通时改为 +100 牌套 */
export const MASTER_POOL_SLEEVES = 200;
export const MASTER_PROF_GAIN: Record<Rarity, number> = { N: 5, R: 10, SR: 20, SSR: 40 };
export const MASTER_FALLBACK_SLEEVES = 100;

/** 兑换：1 普通券 + 50 牌套 = 1 高级券 */
export const HI_TICKET_SLEEVES = 50;

/** 某鱼成交手续费（运筹每级 -0.3%，10 级全免） */
export const SELL_FEE = 0.05;

/** 离线收益折算比例（离线只按 50% 计入 bank，上限 1 小时不变） */
export const OFFLINE_RATE = 0.5;

/** 出售槽位扩充价格：扩到 2/3/4/5 个（初始 1 个，上限 5） */
export const SELL_SLOT_COSTS: readonly number[] = [60, 60, 60, 60];

/** 市场刷新商品数扩充价格：扩到 4/5/6/7 件（初始 3 件，上限 7） */
export const MARKET_SLOT_COSTS: readonly number[] = [50, 50, 50, 50];

export const SELL_SLOTS_MAX = 5;
export const MARKET_SLOTS_MAX = 7;

/** 市场上架定价范围（相对实体总价值） */
export const SELL_PRICE_MIN = 0.5;
export const SELL_PRICE_MAX = 2.0;

// ---------- 成色与价值 ----------

/** 成色比 0~1（0 = 5成新，1 = 全新） */
export function durabilityRatio(durability: number, rarity: Rarity): number {
  return Math.max(0, Math.min(1, durability / DURABILITY[rarity]));
}

/** 成色文案：满耐久「全新」，否则 N 成新（0 耐久 = 5成新） */
export function conditionText(durability: number, rarity: Rarity): string {
  const r = durabilityRatio(durability, rarity);
  return r >= 1 ? '全新' : `${Math.floor(5 + 5 * r)}成新`;
}

/** 单次游玩耐久磨损：基础 1，收纳 ×0.75（一次性扣耐久后生效），牌套 ×0.5 */
export function playWear(stored: boolean, sleeved: boolean): number {
  return (stored ? STORE_WEAR_MULT : 1) * (sleeved ? 0.5 : 1);
}

/**
 * 实体总价值（某鱼买卖的定价基础）：
 * 基础 = 市场价 × (0.5 + 0.5×成色比)；收纳 +20% 市场价；牌套每 50 张 10 元（不足向上取整）。
 */
export function copyValue(
  marketPrice: number,
  cards: number | null,
  durability: number,
  rarity: Rarity,
  sleeved: boolean,
  stored: boolean,
): number {
  const base = marketPrice * (0.5 + 0.5 * durabilityRatio(durability, rarity));
  const extras = (stored ? marketPrice * 0.2 : 0) + (sleeved && cards ? Math.ceil(cards / 50) * 10 : 0);
  return Math.round(base + extras);
}

/**
 * 某鱼出售成交概率：p = clamp01(a − b×定价倍率)，a/b 随成色比线性过渡。
 * 锚点：全新 50% 价必卖（100%）、200% 价 2%（极低但非零）；
 *       5成新 50% 价 90%、200% 价 0（真零）。
 */
export function sellChance(priceMult: number, durability: number, rarity: Rarity): number {
  const r = durabilityRatio(durability, rarity);
  const a = 1.2 + 0.127 * r; // 截距：1.2（5成新）→ 1.327（全新）
  const b = 0.6 + 0.053 * r; // 斜率：0.6（5成新）→ 0.653（全新）
  return Math.max(0, Math.min(1, a - b * priceMult));
}
