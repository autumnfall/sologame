import { FIRST_BONUS } from '../data/constants';
import { DURABILITY } from '../data/balance';
import { gameById } from '../data/games';
import type { Attr } from '../data/constants';
import type { Copy, GameState } from '../state';
import { globalBonus } from '../mechanics/collection';
import { perkLv } from '../mechanics/prestige';

export interface AcquireResult {
  /** 是否首次收藏（触发开箱奖励） */
  first: boolean;
  /** 开箱奖励：受影响的属性与每属性经验值 */
  bonusAttrs: Attr[];
  bonusExp: number;
  /** 本次获得的实体（全新满耐久） */
  copy: Copy;
}

/**
 * 获得一款桌游的实体：push 一个全新满耐久副本；
 * 首次收藏（firstOpened）时按稀有度发放一次性开箱属性奖励（N15/R30/SR60/SSR120，吃图鉴加成）。
 * 熟练度/疲劳/读规则在收藏级保留，卖光重买不重复给开箱奖励。
 */
export function acquireGame(state: GameState, id: string): AcquireResult {
  const g = gameById(id);
  let c = state.collections[id];
  const first = !c || !c.firstOpened;
  if (!c) {
    c = { firstOpened: true, prof: 0, fatigue: 0, rulesRead: false };
    state.collections[id] = c;
  } else {
    c.firstOpened = true;
  }
  const copy: Copy = {
    uid: state.nextUid++,
    gameId: id,
    durability: DURABILITY[g.rarity],
    sleeved: false,
    stored: false,
  };
  state.copies.push(copy);
  const result: AcquireResult = { first, bonusAttrs: [], bonusExp: 0, copy };
  if (first) {
    const fb = FIRST_BONUS[g.rarity] * (1 + globalBonus(state)) * (1 + 0.25 * perkLv(state, 'openExp'));
    result.bonusExp = fb;
    for (const a of g.attrs) {
      state.attrExp[a] += fb;
      result.bonusAttrs.push(a);
    }
  }
  return result;
}
