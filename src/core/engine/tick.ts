import { OFFLINE_CAP_MS } from '../data/constants';
import { STREAM_EVENTS, jobById } from '../data/jobs';
import type { Attr } from '../data/constants';
import { gameById } from '../data/games';
import type { GameState } from '../state';
import { attrShares } from '../mechanics/attrs';
import { globalBonus, hasAffix } from '../mechanics/collection';
import { currentJobRate, expMult, fatigueIncMult, incomeMult, ticketRateMult } from '../mechanics/economy';
import { fatigueMod } from '../mechanics/play';

export interface TickResult {
  /** 本秒收入（元） */
  income: number;
  ticketDrop: boolean;
  streamEvent: string | null;
}

/** 工作每秒结算（游戏内 1 分 = 现实 1 秒）；随机事件由 UI 决定如何呈现 */
export function tickSecond(state: GameState, rng: () => number = Math.random): TickResult {
  const j = state.job ? jobById(state.job) : undefined;
  if (!j || !j.auto) return { income: 0, ticketDrop: false, streamEvent: null };
  const income = currentJobRate(state, rng);
  state.money += income;
  const ticketDrop = rng() < 0.004 * ticketRateMult(state);
  if (ticketDrop) state.tickets++;
  let streamEvent: string | null = null;
  if (j.volatile && rng() < 0.01) {
    streamEvent = STREAM_EVENTS[Math.floor(rng() * STREAM_EVENTS.length)];
  }
  return { income, ticketDrop, streamEvent };
}

/**
 * 离线收益累积：按职业基础期望结算（不吃主播波动的运气），总上限 1 小时、bank 满则不再累积。
 */
export function accumulateOffline(state: GameState, elapsedMs: number): void {
  const j = state.job ? jobById(state.job) : undefined;
  if (!j || !j.auto) return;
  const t = Math.min(elapsedMs, OFFLINE_CAP_MS);
  if (state.offlineBank.t >= OFFLINE_CAP_MS) return;
  const addT = Math.min(t, OFFLINE_CAP_MS - state.offlineBank.t);
  state.offlineBank.t += addT;
  state.offlineBank.money += j.rate * (1 + globalBonus(state)) * incomeMult(state) * (addT / 1000);
}

export function claimOffline(state: GameState): number {
  const amount = state.offlineBank.money;
  state.money += amount;
  state.offlineBank = { t: 0, money: 0, log: [] };
  return amount;
}

export interface SettleResult {
  /** 各属性本局获得的经验 */
  gains: Partial<Record<Attr, number>>;
  /** 本局试玩员收入（元） */
  pay: number;
  ticketDrop: boolean;
  /** 结算后该盒疲劳 */
  fatigue: number;
  /** 是否达到「玩腻了」（疲劳 ≥7） */
  tired: boolean;
  round: number;
}

/**
 * 一局游玩结算（时机条等交互由 UI 驱动，这里只管数值）：
 * 疲劳（该盒 +2、其余 -1）、熟练度 +1、规则标记已读、按属性分摊经验、
 * 试玩员微薄收入、概率掉抽赏券。
 */
export function settleRound(
  state: GameState,
  gameId: string,
  round: number,
  rng: () => number = Math.random,
): SettleResult {
  const g = gameById(gameId);
  const o = state.owned[gameId];
  if (!o || o.count <= 0) throw new Error(`未拥有《${g.name}》`);
  const fInc = Math.max(1, Math.round(2 * fatigueIncMult(state) * (hasAffix(state, 'fatHalf') ? 0.5 : 1)));
  for (const id of Object.keys(state.owned)) {
    if (id === gameId) state.owned[id].fatigue = Math.min(20, state.owned[id].fatigue + fInc);
    else state.owned[id].fatigue = Math.max(0, state.owned[id].fatigue - 1);
  }
  o.prof += 1;
  o.rulesRead = true;
  state.stats.plays += 1;
  const base = g.baseExp * fatigueMod(state, g) * expMult(state);
  const gains: Partial<Record<Attr, number>> = {};
  const shares = attrShares(g);
  g.attrs.forEach((a, i) => {
    const v = base * shares[i];
    state.attrExp[a] += v;
    gains[a] = (gains[a] ?? 0) + v;
  });
  const pay = Math.round((8 + g.baseExp * 0.8) * fatigueMod(state, g) * (1 + globalBonus(state)) * incomeMult(state));
  state.money += pay;
  const ticketDrop = rng() < 0.06 * ticketRateMult(state);
  if (ticketDrop) state.tickets += 1;
  return { gains, pay, ticketDrop, fatigue: o.fatigue, tired: o.fatigue >= 7, round };
}
