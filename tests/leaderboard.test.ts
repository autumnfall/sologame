import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { mergeBoard } from '../src/core';
import type { RunRecord } from '../src/core';
const require = createRequire(import.meta.url);
const { merge, validRecord } = require('../scripts/leaderboard-rules.cjs');

const record = (clientId: string, ms: number, mastered: number): RunRecord => ({
  clientId, ms, mastered, name: clientId, at: 1, runs: 1, insight: 0, achievements: 0,
});

describe('在线排行榜规则', () => {
  it('服务端与客户端对排名、去重、同分和截断的结果一致', () => {
    const entries = [
      record('a', 1000, 1), record('a', 3000, 6),
      record('b', 6000, 12), record('b', 2000, 4),
      record('c', 100, 0), record('d', 1000, 4),
    ];
    expect(merge(entries, 3)).toEqual(mergeBoard(entries, 3));
    expect(merge(entries, 3).map((r: RunRecord) => r.clientId)).toEqual(['d', 'b', 'a']);
  });

  it('拒绝负数、非有限数和缺少精通数的记录', () => {
    for (const entry of [null, {}, record('a', -1, 1), record('a', Infinity, 1), record('a', 10, -1), record('a', 10, 1.5)]) {
      expect(validRecord(entry)).toBe(false);
    }
  });
});
