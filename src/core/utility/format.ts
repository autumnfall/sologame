/** 金额显示：≥10000 用「万」缩写 */
export function fmt(n: number): string {
  return n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.floor(n).toString();
}

/** 时长显示：分钟 / 小时+分钟 / 天+小时（排行榜周目耗时用） */
export function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '不足 1 分钟';
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时 ${m % 60} 分钟`;
  const d = Math.floor(h / 24);
  return `${d} 天 ${h % 24} 小时`;
}
