import { DURABILITY, gameById } from '../src/core';
import type { Copy, GameState } from '../src/core';

/** 确定性伪随机（LCG），避免测试依赖运气 */
export function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** 让属性 attr 恰好升到 lv 级所需的经验（独立复算升级曲线） */
export function expToReach(lv: number): number {
  let e = 0;
  for (let l = 0; l < lv; l++) e += Math.round(60 * Math.pow(l + 1, 1.5));
  return e;
}

/** 只开箱（收藏级），不产生实体；用于图鉴/解锁类测试 */
export function open(s: GameState, id: string, patch: Partial<GameState['collections'][string]> = {}) {
  s.collections[id] = { firstOpened: true, prof: 0, fatigue: 0, rulesRead: false, ...patch };
}

/** 开箱 + 拥有 count 个实体；返回第一个实体（单实体测试直接用） */
export function own(
  s: GameState,
  id: string,
  opts: {
    count?: number; prof?: number; fatigue?: number; rulesRead?: boolean;
    durability?: number; sleeved?: boolean; stored?: boolean;
  } = {},
): Copy {
  const { count = 1, prof = 0, fatigue = 0, rulesRead = false, durability, sleeved = false, stored = false } = opts;
  s.collections[id] = { firstOpened: true, prof, fatigue, rulesRead };
  let first: Copy | undefined;
  for (let i = 0; i < count; i++) {
    const copy: Copy = {
      uid: s.nextUid++,
      gameId: id,
      durability: durability ?? DURABILITY[gameById(id).rarity],
      sleeved: i === 0 && sleeved,
      stored: i === 0 && stored,
    };
    s.copies.push(copy);
    if (!first) first = copy;
  }
  return first!;
}

/** 找出某收藏的第一个可用实体 uid */
export function uidOf(s: GameState, id: string): number {
  return s.copies.find(c => c.gameId === id)!.uid;
}
