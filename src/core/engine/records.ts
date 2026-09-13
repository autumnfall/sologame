import type { GameState, RunRecord } from '../state';
import { totalInsight } from '../mechanics/prestige';

/** 本地榜容量 */
export const LOCAL_BOARD_SIZE = 10;

/**
 * 构造一条周目完成记录：调用时机为 doPrestige 已结算之后
 *（runs/insight 已含本次转生增量，runStartedAt 仍是本周目开局时间——doPrestige 会重置它，需先快照）。
 * insight 记总阅历（剩余 + 已投入，封顶点满所有天赋所需），而非剩余阅历。
 */
export function makeRunRecord(
  state: GameState,
  opts: { startedAt: number; finishedAt: number },
): RunRecord {
  return {
    name: state.playerName.trim().slice(0, 24),
    ms: Math.max(0, opts.finishedAt - opts.startedAt),
    runs: state.prestige.runs,
    insight: totalInsight(state),
    achievements: state.achievements.length,
    at: opts.finishedAt,
    clientId: state.clientId,
  };
}

/** 记录进本地排行榜：按耗时升序插入，只保留前 LOCAL_BOARD_SIZE 条 */
export function recordLocalRun(state: GameState, rec: RunRecord): void {
  state.localBoard.push(rec);
  state.localBoard.sort((a, b) => a.ms - b.ms);
  if (state.localBoard.length > LOCAL_BOARD_SIZE) state.localBoard.length = LOCAL_BOARD_SIZE;
}

/** 合并在线榜：按 clientId 去重（取最好成绩），按耗时升序截断前 n */
export function mergeBoard(entries: RunRecord[], n: number): RunRecord[] {
  const best = new Map<string, RunRecord>();
  for (const e of entries) {
    const key = e.clientId ?? `${e.name}@${e.at}`;
    const cur = best.get(key);
    if (!cur || e.ms < cur.ms) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => a.ms - b.ms).slice(0, n);
}
