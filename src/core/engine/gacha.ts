import { GACHA_PITY, SLEEVE_PACK } from '../data/constants';
import { GACHA_PITY_SSR_SHARE, GACHA_TABLE, ROTATION_PRICE, HI_TICKET_SLEEVES } from '../data/balance';
import { GACHA_PRICE } from '../data/prices';
import { REGULAR_GAMES, gamesByRarity } from '../data/games';
import type { Attr } from '../data/constants';
import type { Rarity } from '../data/types';
import type { GameState } from '../state';
import { acquireGame } from './acquire';
import type { AcquireResult } from './acquire';

export type GachaPool = 'perm' | 'rot';
export type GachaPay = 'money' | 'ticket' | 'hiTicket';

/** 一次抽取的原始结果（牌套包 或 某稀有度桌游） */
export type GachaRoll =
  | { kind: 'sleeves'; packs: number }
  | { kind: 'game'; rarity: Rarity };

export type GachaOutcome =
  | { kind: 'sleeves'; pool: GachaPool; packs: number; /** 到账牌套张数 */ sleeves: number }
  | {
      kind: 'game';
      pool: GachaPool;
      rarity: Rarity;
      gameId: string;
      /** 收藏是否已开箱（false = 首次获得，acquire.first 为 true 时触发开箱奖励） */
      duplicate: boolean;
      acquire: AcquireResult;
    };

/**
 * 判定一次抽取结果（按 GACHA_TABLE 累加；保底时按 3:1 在 SR/SSR 间掷）。
 * 纯函数便于测试：rng 传入具体值可精确命中边界。
 */
export function rollGachaOutcome(rng: () => number, forcePity: boolean): GachaRoll {
  if (forcePity) return { kind: 'game', rarity: rng() < GACHA_PITY_SSR_SHARE ? 'SSR' : 'SR' };
  const r = rng();
  let acc = 0;
  for (const e of GACHA_TABLE) {
    acc += e.p;
    if (r < acc) return e.kind === 'sleeves' ? { kind: 'sleeves', packs: e.packs } : { kind: 'game', rarity: e.rarity };
  }
  return { kind: 'sleeves', packs: 4 };
}

/** 轮换池当前可选桌游（该主题属性下的全部常规款） */
export function rotatingPool(theme: Attr) {
  return REGULAR_GAMES.filter(g => g.attrs.includes(theme));
}

/**
 * 某赏单抽（常驻池或轮换池）。不受某宝级别解锁限制；隐藏款不进池。
 * 常驻池：金钱或普通券；轮换池：金钱或高级券；两者奖池表一致，保底各 50 抽独立计数。
 * 结果：46% 4包 / 15% 10包 / 5% 20包牌套，桌游 N20/R10/SR3/SSR1；
 * 50 抽必出 SR 及以上，抽出 SR/SSR 重置保底，其余结果（含牌套）保底 +1。
 * 桌游结果为全新实体，重复 = 新实体（收藏级进度保留，开箱奖励仅一次，不赠牌套）。
 */
export function gachaDraw(
  state: GameState,
  pool: GachaPool,
  pay: GachaPay,
  rng: () => number = Math.random,
): GachaOutcome | { error: string } {
  // —— 扣费 ——
  if (pool === 'perm') {
    if (pay === 'ticket') {
      if (state.tickets < 1) return { error: '没有普通券' };
      state.tickets--;
    } else {
      if (state.money < GACHA_PRICE) return { error: '钱不够抽赏' };
      state.money -= GACHA_PRICE;
    }
  } else {
    if (!state.rotTheme) return { error: '轮换池尚未开启' };
    if (pay === 'hiTicket') {
      if (state.hiTickets < 1) return { error: '没有高级券' };
      state.hiTickets--;
    } else {
      if (state.money < ROTATION_PRICE) return { error: '钱不够抽赏' };
      state.money -= ROTATION_PRICE;
    }
  }
  state.stats.pulls++;
  // —— 判定与保底 ——
  const pityKey = pool === 'perm' ? 'pity' : 'pityRot';
  const roll = rollGachaOutcome(rng, state[pityKey] >= GACHA_PITY - 1);
  const hitSRplus = roll.kind === 'game' && (roll.rarity === 'SR' || roll.rarity === 'SSR');
  state[pityKey] = hitSRplus ? 0 : state[pityKey] + 1;
  // —— 发放 ——
  if (roll.kind === 'sleeves') {
    const sleeves = roll.packs * SLEEVE_PACK;
    state.sleeves += sleeves;
    return { kind: 'sleeves', pool, packs: roll.packs, sleeves };
  }
  let candidates = gamesByRarity(roll.rarity);
  if (pool === 'rot' && state.rotTheme) {
    const themed = candidates.filter(g => g.attrs.includes(state.rotTheme as Attr));
    if (themed.length) candidates = themed;
  }
  const g = candidates[Math.floor(rng() * candidates.length)] ?? REGULAR_GAMES[0];
  const duplicate = state.collections[g.id]?.firstOpened === true;
  const acquire = acquireGame(state, g.id);
  return { kind: 'game', pool, rarity: roll.rarity, gameId: g.id, duplicate, acquire };
}

/** 兑换高级券：n 张普通券 + 50n 张牌套 → n 张高级券（可批量） */
export function exchangeHiTickets(state: GameState, n: number): { ok: boolean; reason?: string } {
  if (!Number.isInteger(n) || n <= 0) return { ok: false, reason: '数量无效' };
  if (state.tickets < n) return { ok: false, reason: `普通券不够（需要 ${n} 张）` };
  if (state.sleeves < n * HI_TICKET_SLEEVES) return { ok: false, reason: `牌套不够（需要 ${n * HI_TICKET_SLEEVES} 张）` };
  state.tickets -= n;
  state.sleeves -= n * HI_TICKET_SLEEVES;
  state.hiTickets += n;
  return { ok: true, reason: undefined };
}

/** 当前轮换池展示用：主题文案 */
export function rotatingThemeText(theme: Attr | null): string {
  if (!theme) return '即将开启';
  const icon = { 谋略: '🧠', 演算: '📐', 应变: '🎲', 运筹: '🧰', 洞察: '🔍', 沉浸: '📖' } as Record<Attr, string>;
  return `${icon[theme]} ${theme}主题`;
}
