import { mergeBoard } from '../core';
import type { RunRecord } from '../core';

/**
 * 在线排行榜客户端。游戏本体是纯静态站点（GitHub Pages），无法自带服务端，
 * 因此这里对接一个极简 JSON API（参考实现见 scripts/leaderboard-server.cjs）：
 *   POST {api}/submit  body = RunRecord JSON
 *   GET  {api}/board    -> RunRecord[]
 * 未配置或请求失败时静默降级：只展示本地榜。
 */
export const LEADERBOARD_API = '';

/** 提交一条周目成绩；返回是否成功（未配置/离线/服务器错误均返回 false） */
export async function submitRun(rec: RunRecord): Promise<boolean> {
  if (!LEADERBOARD_API) return false;
  try {
    const res = await fetch(`${LEADERBOARD_API}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 拉取在线榜（按 clientId 去重、耗时升序、前 10）；失败返回 null */
export async function fetchBoard(): Promise<RunRecord[] | null> {
  if (!LEADERBOARD_API) return null;
  try {
    const res = await fetch(`${LEADERBOARD_API}/board`);
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return null;
    const list = raw.filter((e): e is RunRecord =>
      typeof e === 'object' && e !== null &&
      typeof (e as RunRecord).ms === 'number' &&
      typeof (e as RunRecord).name === 'string');
    return mergeBoard(list, 10);
  } catch {
    return null;
  }
}
