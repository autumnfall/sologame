import { OFFLINE_CAP_MS, ATTRS } from '../data/constants';
import { OFFLINE_RATE, WORN_PENALTY, playWear, ROTATION_MS } from '../data/balance';
import { STREAM_EVENTS } from '../data/jobs';
import type { Attr } from '../data/constants';
import { gameById } from '../data/games';
import type { GameState } from '../state';
import { copyByUid } from '../state';
import { attrShares } from '../mechanics/attrs';
import { globalBonus, hasAffix } from '../mechanics/collection';
import { currentJob, expMult, fatigueIncMult, incomeMult, jobCyclePay, jobCyclePayExpected, ticketRateMult } from '../mechanics/economy';
import { fatigueMod } from '../mechanics/play';

export interface TickResult {
  /** 本 tick 完成的工作周期数（0 或 1） */
  payout: number;
  /** 本 tick 到账金额（元） */
  payAmount: number;
  ticketDrop: boolean;
  streamEvent: string | null;
}

/**
 * 工作每秒推进（游戏内 1 分 = 现实 1 秒）：jobProgress +1，
 * 满一个周期（job.cycleSec）即一次性发放酬劳，余量进入下一周期；
 * 换工作/辞职会清零进度（actions.ts）。工作中仍按秒判定掉券；主播在周期结算时概率触发直播事件。
 */
export function tickSecond(state: GameState, rng: () => number = Math.random): TickResult {
  const result: TickResult = { payout: 0, payAmount: 0, ticketDrop: false, streamEvent: null };
  const ticketDrop = rng() < 0.004 * ticketRateMult(state);
  if (ticketDrop) state.tickets++;
  result.ticketDrop = ticketDrop;
  const j = currentJob(state);
  if (!j || !j.auto) return result;
  state.jobProgress += 1;
  if (state.jobProgress < j.cycleSec) return result;
  state.jobProgress -= j.cycleSec;
  const pay = jobCyclePay(state, j, rng);
  state.money += pay;
  result.payout = 1;
  result.payAmount = pay;
  if (j.volatile && rng() < 0.3) {
    result.streamEvent = STREAM_EVENTS[Math.floor(rng() * STREAM_EVENTS.length)];
  }
  return result;
}

/**
 * 离线收益累积：按完成的整周期数入账（期望酬劳 × 离线折算 50%），
 * 不足一周期的余量转回 jobProgress；总上限 1 小时、bank 满则不再累积。
 */
export function accumulateOffline(state: GameState, elapsedMs: number): void {
  const j = currentJob(state);
  if (!j || !j.auto) return;
  const t = Math.min(elapsedMs, OFFLINE_CAP_MS);
  if (state.offlineBank.t >= OFFLINE_CAP_MS) return;
  const addT = Math.min(t, OFFLINE_CAP_MS - state.offlineBank.t);
  state.offlineBank.t += addT;
  const total = state.jobProgress + addT / 1000;
  const cycles = Math.floor(total / j.cycleSec);
  state.jobProgress = total - cycles * j.cycleSec;
  state.offlineBank.money += cycles * jobCyclePayExpected(state, j) * OFFLINE_RATE;
}

export function claimOffline(state: GameState): number {
  const amount = state.offlineBank.money;
  state.money += amount;
  state.offlineBank = { t: 0, money: 0, log: [] };
  return amount;
}

export interface SettleResult {
  /** 各属性本局获得的经验（已含 0 耐久惩罚） */
  gains: Partial<Record<Attr, number>>;
  /** 本局试玩员收入（元，已含 0 耐久惩罚） */
  pay: number;
  ticketDrop: boolean;
  /** 结算后收藏疲劳 */
  fatigue: number;
  /** 是否达到「玩腻了」（疲劳 ≥7） */
  tired: boolean;
  /** 本局实体磨损量 */
  wear: number;
  /** 磨损后实体耐久 */
  durability: number;
  /** 本局是否触发了 0 耐久收益惩罚 */
  worn: boolean;
  round: number;
}

/**
 * 一局游玩结算（时机条等交互由 UI 驱动，这里只管数值）：
 * 疲劳/熟练度/读规则记在收藏级（该收藏 +2、其余 -1）；
 * 耐久磨损记在实体上：基础 1，收纳 ×0.75（收纳时一次性扣过耐久），牌套 ×0.5；
 * 耐久归 0 后仍可游玩，但本局起整体收益（经验+收入）×0.5。
 */
export function settleRound(
  state: GameState,
  gameId: string,
  copyUid: number,
  round: number,
  rng: () => number = Math.random,
): SettleResult {
  const g = gameById(gameId);
  const c = state.collections[gameId];
  const copy = copyByUid(state, copyUid);
  if (!c || !c.firstOpened) throw new Error(`未拥有《${g.name}》`);
  if (!copy || copy.gameId !== gameId) throw new Error('实体不存在');
  if (state.listings.some(l => l.copyUid === copyUid)) throw new Error('上架中的实体不可游玩');
  const fInc = Math.max(1, Math.round(2 * fatigueIncMult(state) * (hasAffix(state, 'fatHalf') ? 0.5 : 1)));
  for (const id of Object.keys(state.collections)) {
    if (id === gameId) state.collections[id].fatigue = Math.min(20, state.collections[id].fatigue + fInc);
    else state.collections[id].fatigue = Math.max(0, state.collections[id].fatigue - 1);
  }
  c.prof += 1;
  c.rulesRead = true;
  state.stats.plays += 1;
  // 磨损与 0 耐久惩罚（按开局时的耐久判定：上一局磨光 → 本局起惩罚）
  const worn = copy.durability <= 0;
  const wear = playWear(copy.stored, copy.sleeved);
  copy.durability = Math.max(0, copy.durability - wear);
  const penalty = worn ? WORN_PENALTY : 1;
  const base = g.baseExp * fatigueMod(state, g) * expMult(state) * penalty;
  const gains: Partial<Record<Attr, number>> = {};
  const shares = attrShares(g);
  g.attrs.forEach((a, i) => {
    const v = base * shares[i];
    state.attrExp[a] += v;
    gains[a] = (gains[a] ?? 0) + v;
  });
  const pay = Math.round((8 + g.baseExp * 0.8) * fatigueMod(state, g) * (1 + globalBonus(state)) * incomeMult(state) * penalty);
  state.money += pay;
  const ticketDrop = rng() < 0.06 * ticketRateMult(state);
  if (ticketDrop) state.tickets += 1;
  return {
    gains, pay, ticketDrop,
    fatigue: c.fatigue, tired: c.fatigue >= 7,
    wear, durability: copy.durability, worn, round,
  };
}

export interface RotationTickResult {
  changed: boolean;
  theme: Attr | null;
}

/**
 * 轮换赏池计时：首次调用开池，之后每 10 分钟换主题属性（六维随机）。
 */
export function tickRotation(
  state: GameState,
  rng: () => number = Math.random,
  now: number = Date.now(),
): RotationTickResult {
  if (!state.rotNext) {
    state.rotTheme = ATTRS[Math.floor(rng() * ATTRS.length)];
    state.rotNext = now + ROTATION_MS;
    return { changed: true, theme: state.rotTheme };
  }
  if (now < state.rotNext) return { changed: false, theme: state.rotTheme };
  state.rotTheme = ATTRS[Math.floor(rng() * ATTRS.length)];
  state.rotNext = now + ROTATION_MS;
  return { changed: true, theme: state.rotTheme };
}
