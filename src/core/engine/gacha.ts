import { GACHA_PITY, SLEEVE_PACK } from '../data/constants';
import { GACHA_PRICE, GACHA_RATES, GACHA_PROF_GAIN, GACHA_SLEEVE_PACKS } from '../data/prices';
import { gamesByRarity } from '../data/games';
import type { Rarity } from '../data/types';
import type { GameState } from '../state';
import { acquireGame } from './acquire';
import type { AcquireResult } from './acquire';

export type GachaOutcome =
  | {
      rarity: Rarity;
      gameId: string;
      duplicate: true;
      sleevePacks: number;
      sleeveSheets: number;
      profGain: number;
    }
  | {
      rarity: Rarity;
      gameId: string;
      duplicate: false;
      acquire: AcquireResult;
    };

/** 稀有度判定（按 GACHA_RATES 顺序累加） */
export function rollRarity(rng: () => number, forceSSR: boolean): Rarity {
  if (forceSSR) return 'SSR';
  let r = rng();
  let acc = 0;
  for (const [rar, p] of GACHA_RATES) {
    acc += p;
    if (r < acc) return rar;
  }
  return 'N';
}

/**
 * 某赏单抽。不受某宝级别解锁限制；隐藏款不进池。
 * 重复款不再给库存：转牌套（N×5/R×10/SR×20/SSR×40 包）并叠加熟练度（N+4/R+8/SR+16/SSR+32）。
 * 50 抽硬保底 SSR。
 */
export function gachaDraw(
  state: GameState,
  useTicket: boolean,
  rng: () => number = Math.random,
): GachaOutcome | { error: string } {
  if (useTicket) {
    if (state.tickets < 1) return { error: '没有抽赏券' };
    state.tickets--;
  } else {
    if (state.money < GACHA_PRICE) return { error: '钱不够抽赏' };
    state.money -= GACHA_PRICE;
  }
  state.stats.pulls++;
  const rarity = rollRarity(rng, state.pity >= GACHA_PITY - 1);
  const pool = gamesByRarity(rarity);
  const g = pool[Math.floor(rng() * pool.length)];
  if (rarity === 'SSR') state.pity = 0;
  else state.pity++;
  const owned = (state.owned[g.id]?.count ?? 0) > 0;
  if (owned) {
    const packs = GACHA_SLEEVE_PACKS[rarity];
    const profGain = GACHA_PROF_GAIN[rarity];
    state.sleeves += packs * SLEEVE_PACK;
    state.owned[g.id].prof += profGain;
    return {
      rarity, gameId: g.id, duplicate: true,
      sleevePacks: packs, sleeveSheets: packs * SLEEVE_PACK, profGain,
    };
  }
  const acquire = acquireGame(state, g.id);
  return { rarity, gameId: g.id, duplicate: false, acquire };
}
