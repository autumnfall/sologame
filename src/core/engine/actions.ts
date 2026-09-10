import { gameById, gamesByRarity, nextTier } from '../data/games';
import { taobaoBase } from '../data/prices';
import type { GameState } from '../state';
import { tierOwned, tierUnlocked } from '../mechanics/collection';
import { storageCost, canStore } from '../mechanics/play';
import { acquireGame } from './acquire';
import { buyXianyu } from './xianyu';

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

function ok(message: string): ActionResult {
  return { ok: true, message };
}

function fail(reason: string): ActionResult {
  return { ok: false, reason };
}

/** 开局三选一 */
export function pickStarter(state: GameState, id: string): ActionResult {
  if (state.started) return fail('已完成开局选择');
  const r = acquireGame(state, id);
  state.started = true;
  return ok(`获得了《${gameById(id).name}》！${firstBonusText(r)}`);
}

function firstBonusText(r: { first: boolean; bonusExp: number }): string {
  return r.first ? `开箱奖励：全属性经验 +${Math.round(r.bonusExp)}` : '';
}

/** 某宝购买：每款限购 1 件、已拥有不可再购、按稀有度逐级解锁 */
export function buyTaobao(state: GameState, id: string): ActionResult {
  const g = gameById(id);
  if ((state.owned[id]?.count ?? 0) > 0) return fail('已收藏过这款桌游');
  const price = taobaoBase(g);
  if (state.money < price) return fail('钱不够');
  if ((state.taobaoStock[id] ?? 0) <= 0) return fail('已售罄');
  if (!tierUnlocked(state, g.rarity)) return fail('该级别尚未解锁');
  state.money -= price;
  state.taobaoStock[id] = (state.taobaoStock[id] ?? 0) - 1;
  const r = acquireGame(state, id);
  let message = `购入《${g.name}》！${firstBonusText(r)}`;
  const next = nextTier(g.rarity);
  if (next && tierOwned(state, g.rarity) >= gamesByRarity(g.rarity).length) {
    message += ` 🎉 ${g.rarity} 级图鉴集齐！某宝解锁 ${next} 级货架`;
  }
  return ok(message);
}

export { buyXianyu };

/** 套牌套：按实际卡牌数消耗牌套张数（无卡牌游戏不可套） */
export function applySleeve(state: GameState, id: string): ActionResult {
  const g = gameById(id);
  if (!g.cards || g.cards <= 0) return fail('这款桌游没有卡牌，无需牌套');
  const o = state.owned[id];
  if (!o || o.count <= 0) return fail('尚未收藏');
  if (o.sleeved) return fail('已套牌套');
  if (state.sleeves < g.cards) return fail(`牌套不够，需要 ${g.cards} 张`);
  state.sleeves -= g.cards;
  o.sleeved = true;
  return ok(`《${g.name}》已套牌套（消耗 ${g.cards} 张），游玩时长 ×0.85`);
}

/** 收纳：仅市场价 >¥200 或大盒，费用 = 基础价 × 0.2 */
export function applyStorage(state: GameState, id: string): ActionResult {
  const g = gameById(id);
  const o = state.owned[id];
  if (!o || o.count <= 0) return fail('尚未收藏');
  if (o.stored) return fail('已收纳');
  if (!canStore(g)) return fail('小盒·无需收纳');
  const cost = storageCost(g);
  if (state.money < cost) return fail('钱不够');
  state.money -= cost;
  o.stored = true;
  return ok(`《${g.name}》收纳完成，Setup ×0.5`);
}

/** 上岗/辞职 */
export function takeJob(state: GameState, jobId: string): ActionResult {
  state.job = jobId;
  return ok('已上岗');
}

export function quitJob(state: GameState): ActionResult {
  state.job = null;
  return ok('已辞职休息');
}

/** 初始上架：某宝每款 1 件（存量为空时调用，幂等） */
export function initTaobaoStock(state: GameState): void {
  if (Object.keys(state.taobaoStock).length > 0) return;
  for (const g of gamesByRarity('N')) state.taobaoStock[g.id] = 1;
  for (const g of gamesByRarity('R')) state.taobaoStock[g.id] = 1;
  for (const g of gamesByRarity('SR')) state.taobaoStock[g.id] = 1;
  for (const g of gamesByRarity('SSR')) state.taobaoStock[g.id] = 1;
}
