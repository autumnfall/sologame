import { FIRST_BONUS } from '../data/constants';
import { gameById } from '../data/games';
import type { Attr } from '../data/constants';
import type { GameState } from '../state';
import { globalBonus } from '../mechanics/collection';

export interface AcquireResult {
  /** 是否首次收藏（触发开箱奖励） */
  first: boolean;
  /** 开箱奖励：受影响的属性与每属性经验值 */
  bonusAttrs: Attr[];
  bonusExp: number;
}

/**
 * 获得一款桌游：count+1；首次获得时按稀有度发放一次性开箱属性奖励
 * （N15 / R30 / SR60 / SSR120，吃图鉴加成）。
 */
export function acquireGame(state: GameState, id: string): AcquireResult {
  const g = gameById(id);
  if (!state.owned[id]) {
    state.owned[id] = { count: 0, prof: 0, fatigue: 0, sleeved: false, stored: false, rulesRead: false };
  }
  const o = state.owned[id];
  o.count++;
  const result: AcquireResult = { first: o.count === 1, bonusAttrs: [], bonusExp: 0 };
  if (result.first) {
    const fb = FIRST_BONUS[g.rarity] * (1 + globalBonus(state));
    result.bonusExp = fb;
    for (const a of g.attrs) {
      state.attrExp[a] += fb;
      result.bonusAttrs.push(a);
    }
  }
  return result;
}
