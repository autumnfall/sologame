import { TAOBAO_STOCK, SELL_SLOT_COSTS, MARKET_SLOT_COSTS, SELL_SLOTS_MAX, MARKET_SLOTS_MAX, SELL_PRICE_MIN, SELL_PRICE_MAX, STORE_WEAR_ONCE, copyValue } from '../data/balance';
import { gameById, gamesByRarity, nextTier, REGULAR_GAMES } from '../data/games';
import type { GameState } from '../state';
import { copyByUid } from '../state';
import { tierOwned, tierUnlocked } from '../mechanics/collection';
import { storageCost, canStore } from '../mechanics/play';
import { sellFeeRate, taobaoPrice } from '../mechanics/economy';
import { perkLevel } from '../mechanics/prestige';
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

/** 开局三选一；老友馈赠天赋：额外随机获得尚未收藏的常规款桌游 */
export function pickStarter(state: GameState, id: string, rng: () => number = Math.random): ActionResult {
  if (state.started) return fail('已完成开局选择');
  const r = acquireGame(state, id);
  state.started = true;
  const gifts: string[] = [];
  for (let i = 0; i < perkLevel(state, 'gift'); i++) {
    const pool = REGULAR_GAMES.filter(g => !state.collections[g.id]?.firstOpened);
    if (!pool.length) break;
    // 80% 抽 N 档 / 20% 抽 R 档；目标档已集齐则任取剩余
    const wantN = rng() < 0.8;
    const cand = pool.filter(g => (g.rarity === 'N') === wantN);
    const src = cand.length ? cand : pool;
    const pick = src[Math.floor(rng() * src.length)];
    acquireGame(state, pick.id);
    gifts.push(pick.name);
  }
  const giftText = gifts.length ? ` 老友馈赠：${gifts.map(n => `《${n}》`).join('、')}` : '';
  return ok(`获得了《${gameById(id).name}》！${firstBonusText(r)}${giftText}`);
}

function firstBonusText(r: { first: boolean; bonusExp: number }): string {
  return r.first ? `开箱奖励：全属性经验 +${Math.round(r.bonusExp)}` : '';
}

/** 某宝购买：每款限量 N4/R3/SR2/SSR1 次，售完不补；按稀有度逐级解锁；购入为全新实体（会员折扣天赋生效） */
export function buyTaobao(state: GameState, id: string): ActionResult {
  const g = gameById(id);
  const price = taobaoPrice(state, g);
  if (state.money < price) return fail('钱不够');
  const left = state.taobaoStock[id] ?? TAOBAO_STOCK[g.rarity];
  if (left <= 0) return fail('已售罄');
  if (!tierUnlocked(state, g.rarity)) return fail('该级别尚未解锁');
  state.money -= price;
  state.taobaoStock[id] = left - 1;
  state.stats.tbBought++;
  const r = acquireGame(state, id);
  let message = `购入全新《${g.name}》！${firstBonusText(r)}`;
  const next = nextTier(g.rarity);
  if (next && tierOwned(state, g.rarity) >= gamesByRarity(g.rarity).length) {
    message += ` 🎉 ${g.rarity} 级图鉴集齐！某宝解锁 ${next} 级货架`;
  }
  return ok(message);
}

export { buyXianyu };

/** 套牌套（实体级）：按实际卡牌数消耗牌套张数（无卡牌游戏不可套） */
export function applySleeve(state: GameState, uid: number): ActionResult {
  const copy = copyByUid(state, uid);
  if (!copy) return fail('实体不存在');
  const g = gameById(copy.gameId);
  if (!g.cards || g.cards <= 0) return fail('这款桌游没有卡牌，无需牌套');
  if (copy.sleeved) return fail('已套牌套');
  if (state.listings.some(l => l.copyUid === uid)) return fail('上架中的实体不可操作');
  if (state.sleeves < g.cards) return fail(`牌套不够，需要 ${g.cards} 张`);
  state.sleeves -= g.cards;
  copy.sleeved = true;
  return ok(`《${g.name}》已套牌套（消耗 ${g.cards} 张），游玩时长 ×0.85、磨损减半`);
}

/** 收纳（实体级）：仅市场价 >¥200 或大盒，费用 = 基础价 × 0.2；一次性按稀有度扣耐久（N1/R2/SR3/SSR4），之后磨损 ×0.75 */
export function applyStorage(state: GameState, uid: number): ActionResult {
  const copy = copyByUid(state, uid);
  if (!copy) return fail('实体不存在');
  const g = gameById(copy.gameId);
  if (copy.stored) return fail('已收纳');
  if (state.listings.some(l => l.copyUid === uid)) return fail('上架中的实体不可操作');
  if (!canStore(g)) return fail('小盒·无需收纳');
  const cost = storageCost(g);
  if (state.money < cost) return fail('钱不够');
  state.money -= cost;
  copy.stored = true;
  const once = STORE_WEAR_ONCE[g.rarity];
  copy.durability = Math.max(0, copy.durability - once);
  return ok(`《${g.name}》收纳完成，Setup ×0.5、磨损 ×0.75（整理一次性 -${once} 耐久）`);
}

/** 一键套牌套：给所有未套且牌足够的实体套牌套（成就里程碑解锁） */
export function sleeveAll(state: GameState): { count: number; used: number } {
  let count = 0;
  let used = 0;
  for (const c of state.copies) {
    if (c.sleeved) continue;
    const g = gameById(c.gameId);
    if (!g.cards || g.cards <= 0) continue;
    if (state.listings.some(l => l.copyUid === c.uid)) continue;
    if (state.sleeves < g.cards) continue; // 剩余不够的跳过
    state.sleeves -= g.cards;
    used += g.cards;
    c.sleeved = true;
    count++;
  }
  return { count, used };
}

/** 一键上架磨光件：所有耐久 0 的未上架实体按行情价（100%）上架，占满槽位为止 */
export function listWornCopies(state: GameState): { count: number } {
  let count = 0;
  for (const c of state.copies) {
    if (c.durability > 0) continue;
    if (state.listings.length >= state.sellSlots) break;
    if (state.listings.some(l => l.copyUid === c.uid)) continue;
    if (listCopy(state, c.uid, 1.0).ok) count++;
  }
  return { count };
}

/** 上岗/辞职：换工作会放弃当前周期进度 */
export function takeJob(state: GameState, jobId: string): ActionResult {
  state.job = jobId;
  state.jobProgress = 0;
  return ok('已上岗，新周期从头开始');
}

export function quitJob(state: GameState): ActionResult {
  state.job = null;
  state.jobProgress = 0;
  return ok('已辞职休息');
}

/** 某鱼出售：上架实体（定价 = 总价值 × 倍率，50%~200%），占用出售槽位 */
export function listCopy(state: GameState, uid: number, priceMult: number): ActionResult {
  const copy = copyByUid(state, uid);
  if (!copy) return fail('实体不存在');
  if (state.listings.some(l => l.copyUid === uid)) return fail('已在上架中');
  if (state.listings.length >= state.sellSlots) return fail('出售槽位已满，可花钱扩充');
  const g = gameById(copy.gameId);
  if (priceMult < SELL_PRICE_MIN || priceMult > SELL_PRICE_MAX) return fail('定价需在 50%~200% 之间');
  const value = copyValue(g.marketPrice, g.cards, copy.durability, g.rarity, copy.sleeved, copy.stored);
  const price = Math.max(10, Math.round(value * priceMult));
  state.listings.push({ copyUid: uid, price });
  const fee = Math.round(sellFeeRate(state) * 1000) / 10;
  return ok(`《${g.name}》已上架 ¥${price}（成交价收取 ${fee}% 手续费）`);
}

/** 某鱼出售：随时下架，实体退回 */
export function unlistCopy(state: GameState, uid: number): ActionResult {
  const i = state.listings.findIndex(l => l.copyUid === uid);
  if (i < 0) return fail('未在上架中');
  state.listings.splice(i, 1);
  return ok('已下架');
}

/** 扩充出售槽位（1→5） */
export function expandSellSlots(state: GameState): ActionResult {
  const i = state.sellSlots - 1; // 当前槽位 1 对应下标 0
  if (state.sellSlots >= SELL_SLOTS_MAX) return fail('出售槽位已达上限');
  const cost = SELL_SLOT_COSTS[i];
  if (state.money < cost) return fail(`钱不够（需要 ¥${cost}）`);
  state.money -= cost;
  state.sellSlots += 1;
  return ok(`出售槽位扩充至 ${state.sellSlots} 个`);
}

/** 扩充市场刷新商品数（3→7） */
export function expandMarketSlots(state: GameState): ActionResult {
  const i = state.marketSlots - 3;
  if (state.marketSlots >= MARKET_SLOTS_MAX) return fail('市场货架已达上限');
  const cost = MARKET_SLOT_COSTS[i];
  if (state.money < cost) return fail(`钱不够（需要 ¥${cost}）`);
  state.money -= cost;
  state.marketSlots += 1;
  return ok(`市场每次刷新 ${state.marketSlots} 件商品`);
}

/** 初始上架：某宝库存按稀有度写满（幂等；已有条目不覆盖，兼容迁移后的 0 库存） */
export function initTaobaoStock(state: GameState): void {
  const all = [...gamesByRarity('N'), ...gamesByRarity('R'), ...gamesByRarity('SR'), ...gamesByRarity('SSR')];
  for (const g of all) {
    if (state.taobaoStock[g.id] === undefined) state.taobaoStock[g.id] = TAOBAO_STOCK[g.rarity];
  }
}
