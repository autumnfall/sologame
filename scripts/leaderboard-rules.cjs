/** 服务端与客户端的排行榜规则保持一致：精通/耗时降序，同值耗时升序。 */
function validRecord(e) {
  return e !== null && typeof e === 'object'
    && typeof e.name === 'string'
    && Number.isFinite(e.ms) && e.ms > 0
    && Number.isSafeInteger(e.mastered) && e.mastered >= 0
    && (e.clientId === undefined || (typeof e.clientId === 'string' && e.clientId.length > 0));
}
const ratio = e => e.mastered > 0 && e.ms > 0 ? e.mastered / e.ms : 0;
const compare = (a, b) => ratio(b) - ratio(a) || a.ms - b.ms;
function merge(list, n = 10) {
  const best = new Map();
  for (const e of list) {
    if (!validRecord(e)) continue;
    const key = e.clientId ?? `${e.name}@${e.at}`;
    const cur = best.get(key);
    if (!cur || compare(e, cur) < 0) best.set(key, e);
  }
  return [...best.values()].sort(compare).slice(0, n);
}
module.exports = { validRecord, merge };
