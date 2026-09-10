import { ATTR_ICON, ATTRS, EXP_SHARES } from '../data/constants';
import type { Attr } from '../data/constants';
import type { Game } from '../data/types';
import type { GameState } from '../state';

/** 属性进度：当前等级、本级已积累的经验、升级所需经验 */
export function attrProgress(state: GameState, attr: Attr): { lv: number; cur: number; need: number } {
  let e = state.attrExp[attr];
  let need = 60;
  let lv = 0;
  while (e >= need) {
    e -= need;
    lv++;
    need = Math.round(60 * Math.pow(lv + 1, 1.5));
  }
  return { lv, cur: Math.floor(e), need };
}

/** 属性等级（罗马数字级别） */
export function attrLevel(state: GameState, attr: Attr): number {
  return attrProgress(state, attr).lv;
}

/**
 * 每局属性经验分配比例（按游戏属性个数）。
 * 单属性全拿；双属性 65/35；三属性 50/30/20；四属性 40/30/20/10；六属性均分 20/20/15/15/15/15。
 */
export function attrShares(g: Game): readonly number[] {
  const n = g.attrs.length;
  return EXP_SHARES[n] ?? g.attrs.map(() => 1 / n);
}

/** 每局预计属性增益（直接展示在卡片上，稀有度越高基础经验越多） */
export function gainText(g: Game): string {
  const shares = attrShares(g);
  return g.attrs.map((a, i) => `${ATTR_ICON[a]}${a}+${Math.round(g.baseExp * shares[i])}`).join(' ');
}

/** 职业门槛是否满足 */
export function jobUnlocked(state: GameState, req: Partial<Record<Attr, number>>): boolean {
  return ATTRS.every(a => (req[a] ?? 0) <= attrLevel(state, a));
}
