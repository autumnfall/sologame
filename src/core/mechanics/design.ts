import {
  INSPIRE_BY_RARITY, INSPIRE_HIDDEN_MULT, Q_BASE, RARITY_DEMAND_BONUS,
  dimByKey, rarityOf, scaleById, themeById, themeDimKey,
} from '../data/designs';
import type { Game } from '../data/types';
import type { DesignCampaign, GameState, Prototype } from '../state';
import { attrLevel } from './attrs';
import { challengeShopLv } from './challenge';

/** 当前灵感获取倍率：insp-up 每级 +15% */
export function inspireMult(state: GameState): number {
  return 1 + 0.15 * challengeShopLv(state, 'inspUp');
}

/** 一局游玩可获得的灵感（按稀有度，隐藏款 ×2；入账处 cap 999） */
export function inspireGain(state: GameState, g: Game): number {
  const base = INSPIRE_BY_RARITY[g.rarity] * (g.hidden ? INSPIRE_HIDDEN_MULT : 1);
  return base * inspireMult(state);
}

/** Q 乘区：score-up 每级 +8% */
export function scoreMult(state: GameState): number {
  return 1 + 0.08 * challengeShopLv(state, 'scoreUp');
}

/**
 * 质量分 Q = clamp(1, 100, round((30 + Σ(各维度迭代次数 × 维度增益)) × (1+0.08×scoreUp)))。
 * 维度增益 = 2 + floor(0.4 × 关联属性等级) + 主题主场维度 +1。纯函数：原型卡预估与发起锁定时共用。
 */
export function qualityOf(state: GameState, proto: Pick<Prototype, 'themeId' | 'iter'>): number {
  const theme = themeById(proto.themeId);
  const home = themeDimKey(theme);
  let q = Q_BASE;
  for (const [key, n] of Object.entries(proto.iter)) {
    if (!n) continue;
    const dim = dimByKey(key);
    q += n * (2 + Math.floor(0.4 * attrLevel(state, dim.attr)) + (key === home ? 1 : 0));
  }
  return Math.max(1, Math.min(100, Math.round(q * scoreMult(state))));
}

/** 成本价 = round(体量基数 × (0.8+Q/100)) */
export function costPriceOf(q: number, scaleId: string): number {
  return Math.round(scaleById(scaleId).costBase * (0.8 + q / 100));
}

/** 众筹需求倍率：挑战商店「畅销作家」每级 +6%（royaltyUp 乘区改用于此） */
export function appealMult(state: GameState): number {
  return 1 + 0.06 * challengeShopLv(state, 'royaltyUp');
}

export interface DemandParts {
  /** 题材匹配：两个随机钟意题材各 +10% */
  theme: number;
  /** 售价 < ¥200：+10% */
  cheap: number;
  /** 溢价线性：+30% × (10−售价/成本价)/9 */
  margin: number;
  /** 稀有度：N/R/SR/SSR = +0/5/10/20% */
  rarity: number;
  /** 畅销作家：每级 +6% */
  perk: number;
  /** 合计（封顶 100%） */
  total: number;
}

/** 单人购买概率分解（测试与 UI 成功率提示共用）；fav1/fav2 为随机抽到的两个钟意题材 */
export function demandParts(
  state: GameState,
  c: Pick<DesignCampaign, 'themeId' | 'price' | 'costPrice' | 'rarity'>,
  fav1: string,
  fav2: string,
): DemandParts {
  const theme = (fav1 === c.themeId ? 0.1 : 0) + (fav2 === c.themeId ? 0.1 : 0);
  const cheap = c.price < 200 ? 0.1 : 0;
  const ratio = Math.min(10, Math.max(1, c.price / Math.max(1, c.costPrice)));
  const margin = 0.3 * (10 - ratio) / 9;
  const rarity = RARITY_DEMAND_BONUS[c.rarity];
  const perk = 0.06 * challengeShopLv(state, 'royaltyUp');
  const total = Math.min(1, theme + cheap + margin + rarity + perk);
  return { theme, cheap, margin, rarity, perk, total };
}

/** 单人购买概率（fav1/fav2 由调用方随机抽取） */
export function demandProb(
  state: GameState,
  c: Pick<DesignCampaign, 'themeId' | 'price' | 'costPrice' | 'rarity'>,
  fav1: string,
  fav2: string,
): number {
  return demandParts(state, c, fav1, fav2).total;
}

/** 成功率提示（UI）：按两个钟意题材都命中本作的上限展示 */
export function demandHint(state: GameState, c: Pick<DesignCampaign, 'themeId' | 'price' | 'costPrice' | 'rarity'>): number {
  return demandProb(state, c, c.themeId, c.themeId);
}

/** gameId（design-N）→ 设计信息（名称/售价/体量），供存量 designed 实体出售/套牌套 */
export function designByGameId(
  state: GameState,
  gameId: string,
): { uid: number; name: string; price: number; scale: string } | undefined {
  const uid = Number(gameId.replace('design-', ''));
  if (!Number.isInteger(uid) || uid <= 0) return undefined;
  const hit = state.designer.campaigns.find(c => c.uid === uid)
    ?? state.designer.prototypes.map(p => ({ ...p, price: 0 })).find(p => p.uid === uid)
    ?? state.designer.funded.find(f => f.uid === uid);
  if (!hit) return undefined;
  // funded 记录不含体量，回落标准（仅影响存量 designed 副本套牌套花费）
  const scale = 'scale' in hit ? hit.scale : 'standard';
  return { uid: hit.uid, name: hit.name, price: hit.price, scale };
}

export { rarityOf, scaleById, themeById, themeDimKey };
