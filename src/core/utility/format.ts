/** 金额显示：≥10000 用「万」缩写 */
export function fmt(n: number): string {
  return n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.floor(n).toString();
}
