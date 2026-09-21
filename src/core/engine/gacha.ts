import { GACHA_PITY, SLEEVE_PACK } from '../data/constants';
import { GACHA_PITY_SSR_SHARE, GACHA_TABLE, ROTATION_PRICE, HI_TICKET_SLEEVES, GAME_POOL_TABLE, MASTER_POOL_SLEEVES, MASTER_PROF_GAIN, MASTER_FALLBACK_SLEEVES } from '../data/balance';
import { GACHA_PRICE } from '../data/prices';
import { GAMES, REGULAR_GAMES, gamesByRarity } from '../data/games';
import type { Attr } from '../data/constants';
import type { Rarity } from '../data/types';
import type { GameState } from '../state';
import { acquireGame } from './acquire';
import type { AcquireResult } from './acquire';
import { isMastered } from '../mechanics/collection';
import { perkLv } from '../mechanics/prestige';
import { challengeMods, distinctCapBlock } from '../mechanics/challenge';

export type GachaPool = 'perm' | 'rot' | 'master';
export type GachaPay = 'money' | 'ticket' | 'hiTicket' | 'sleeves';

/** 某赏金钱单抽价（含挑战价格倍率，如「柠檬佬」×1.5；常驻池与桌游池） */
export function gachaMoneyPrice(state: GameState, pool: 'perm' | 'rot'): number {
  const base = pool === 'perm' ? GACHA_PRICE : ROTATION_PRICE;
  return Math.max(1, Math.round(base * (challengeMods(state).gachaPriceMult ?? 1)));
}

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
    }
  | {
      /** 精通池专属：不获得桌游，直接加对应收藏的熟练值 */
      kind: 'prof';
      pool: 'master';
      rarity: Rarity;
      gameId: string;
      /** 本次获得的熟练值 */
      prof: number;
      /** 本次加成后是否达到精通 */
      masteredNow: boolean;
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

/** 纯桌游奖池（桌游池/精通池共用）：N60 / R30 / SR8 / SSR2；保底时按 3:1 在 SR/SSR 间掷 */
export function rollGameRarity(rng: () => number, forcePity: boolean): Rarity {
  if (forcePity) return rng() < GACHA_PITY_SSR_SHARE ? 'SSR' : 'SR';
  const r = rng();
  let acc = 0;
  for (const e of GAME_POOL_TABLE) {
    acc += e.p;
    if (r < acc) return e.rarity;
  }
  return 'N';
}

/** 桌游池当前可选桌游（该主题属性下的全部常规款） */
export function rotatingPool(theme: Attr) {
  return REGULAR_GAMES.filter(g => g.attrs.includes(theme));
}

/** 精通池奖池：已入手（开箱过）且未精通的全部桌游（含隐藏款；熟练值挂在收藏上） */
export function masterPool(state: GameState) {
  return GAMES.filter(g => state.collections[g.id]?.firstOpened && !isMastered(state, g.id));
}

/**
 * 某赏单抽（常驻池 / 桌游池 / 精通池）。不受某宝级别解锁限制；常驻池与桌游池的隐藏款不进池。
 * 常驻池：金钱或普通券，奖池含牌套（GACHA_TABLE）；
 * 桌游池（原轮换池）：金钱或高级券，仅出桌游（N60/R30/SR8/SSR2），每 10 分钟轮换主题属性；
 * 精通池：固定 200 张牌套，范围为本局已入手且未精通的桌游，抽到直接加熟练值（N5/R10/SR20/SSR40），
 * 抽中的稀有度已全部精通时改为 +100 牌套；不参与保底计数。
 * 保底：常驻池与桌游池各 50 抽独立计数，抽出 SR/SSR 重置，其余结果 +1。
 * 挑战修饰：金钱单抽价乘 gachaPriceMult（柠檬佬）；款数上限（叉叉）到限时若抽出的是架上新款桌游则拒抽
 * （不扣费、不计抽数、不动保底）。
 */
export function gachaDraw(
  state: GameState,
  pool: GachaPool,
  pay: GachaPay,
  rng: () => number = Math.random,
): GachaOutcome | { error: string } {
  // —— 精通池：牌套支付，无保底 ——
  if (pool === 'master') {
    if (!masterPool(state).length) return { error: '所有桌游均已精通，精通池暂无奖池' };
    if (state.sleeves < MASTER_POOL_SLEEVES) return { error: `牌套不够（需要 ${MASTER_POOL_SLEEVES} 张）` };
    state.sleeves -= MASTER_POOL_SLEEVES;
    state.stats.pulls++;
    // 每次抽取时重新确定范围：十连中途精通某款后，后续抽取不再命中它
    const rarity = rollGameRarity(rng, false);
    const cands = masterPool(state).filter(g => g.rarity === rarity);
    if (!cands.length) {
      state.sleeves += MASTER_FALLBACK_SLEEVES;
      return { kind: 'sleeves', pool, packs: MASTER_FALLBACK_SLEEVES / SLEEVE_PACK, sleeves: MASTER_FALLBACK_SLEEVES };
    }
    const g = cands[Math.floor(rng() * cands.length)];
    const prof = MASTER_PROF_GAIN[rarity];
    state.collections[g.id].prof += prof;
    return { kind: 'prof', pool, rarity, gameId: g.id, prof, masteredNow: isMastered(state, g.id) };
  }
  // —— 预检与判定（扣费后置：挑战「款数上限」拒抽新款时不损失金钱/券/保底） ——
  if (pool === 'rot' && !state.rotTheme) return { error: '桌游池尚未开启' };
  const price = gachaMoneyPrice(state, pool);
  if (pay === 'ticket' && state.tickets < 1) return { error: '没有普通券' };
  if (pay === 'hiTicket' && state.hiTickets < 1) return { error: '没有高级券' };
  if (pay === 'money' && state.money < price) return { error: '钱不够抽赏' };
  const pityKey = pool === 'perm' ? 'pity' : 'pityRot';
  const pityNeed = Math.max(10, GACHA_PITY - 5 * perkLv(state, 'pityCut'));
  const forcePity = state[pityKey] >= pityNeed - 1;
  const roll = pool === 'rot' ? { kind: 'game', rarity: rollGameRarity(rng, forcePity) } as const : rollGachaOutcome(rng, forcePity);
  const charge = (): void => {
    if (pay === 'ticket') state.tickets--;
    else if (pay === 'hiTicket') state.hiTickets--;
    else state.money -= price;
  };
  if (roll.kind === 'sleeves') {
    charge();
    state.stats.pulls++;
    state[pityKey]++; // 牌套结果也计保底
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
  // 挑战「款数上限」：到限且抽出的是架上没有的新款桌游 → 拒抽
  const block = distinctCapBlock(state, g.id);
  if (block) return { error: block };
  charge();
  state.stats.pulls++;
  if (forcePity) state.stats.pityHits++;
  const hitSRplus = roll.rarity === 'SR' || roll.rarity === 'SSR';
  state[pityKey] = hitSRplus ? 0 : state[pityKey] + 1;
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
