import { CHALLENGES, CHALLENGE_SHOP, challengeDefById, challengeShopDefById } from '../data/challenges';
import type { ChallengeDef, ChallengeMods, ChallengeShopDef, ChallengeShopKey } from '../data/challenges';
import type { GameState } from '../state';
import { isMastered, kindCount } from './collection';
import { GAMES } from '../data/games';

export type ChallengeActionResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

function ok(message: string): ChallengeActionResult {
  return { ok: true, message };
}

function fail(reason: string): ChallengeActionResult {
  return { ok: false, reason };
}

/** 当前激活挑战的条件修饰（无激活则全默认：空对象） */
export function challengeMods(state: GameState): ChallengeMods {
  const id = state.challenge.active;
  if (!id) return {};
  const def = CHALLENGES.find(c => c.id === id);
  return def ? def.mods : {};
}

/** 指定挑战商店物品的当前等级 */
export function challengeShopLevel(state: GameState, id: string): number {
  return state.prestige.shop[id] ?? 0;
}

/** 按效果键取等级（一个 key 只对应一个物品；新物品在 data/challenges.ts 登记即可） */
export function challengeShopLv(state: GameState, key: ChallengeShopKey): number {
  for (const p of CHALLENGE_SHOP) if (p.key === key) return state.prestige.shop[p.id] ?? 0;
  return 0;
}

/** 下一级价格 = base + step × 当前等级 */
export function challengeShopCost(def: ChallengeShopDef, curLv: number): number {
  return def.base + def.step * curLv;
}

/** 前置是否满足：无前置永远可买；否则需前置物品 ≥1 级 */
export function challengeShopPrereqMet(state: GameState, def: ChallengeShopDef): boolean {
  if (!def.after) return true;
  return challengeShopLevel(state, def.after) >= 1;
}

/** 挑战是否已解锁：requires 全部在 challengeDone 中（无 requires = 第一层，开局即可激活） */
export function challengeAvailable(state: GameState, id: string): boolean {
  const def = CHALLENGES.find(c => c.id === id);
  if (!def) return false;
  return (def.requires ?? []).every(r => state.prestige.challengeDone.includes(r));
}

/** 收藏架上存在实体的不同桌游款数（copies 去重 gameId） */
export function distinctCopyKinds(state: GameState): number {
  return new Set(state.copies.map(c => c.gameId)).size;
}

/** 当前激活挑战的目标进度（无激活返回 0） */
export function goalProgress(state: GameState): number {
  const id = state.challenge.active;
  if (!id) return 0;
  const def = CHALLENGES.find(c => c.id === id);
  if (!def) return 0;
  switch (def.goal.type) {
    case 'xyEarn': return state.stats.xyEarned;
    case 'bargainBuys': return state.stats.bargainBuys;
    case 'masteryCount': return GAMES.filter(g => isMastered(state, g.id)).length;
    case 'plays': return state.stats.plays;
    case 'highPriceSold': return state.stats.highPriceSold;
    case 'pulls': return state.stats.pulls;
    case 'distinctCopies': return distinctCopyKinds(state);
    case 'distinctCollections': return kindCount(state);
  }
}

export interface ChallengeDoneEvent {
  def: ChallengeDef;
  /** 入账的挑战币 */
  reward: number;
}

/**
 * 扫描挑战：更新进度；达成且未领过奖励则入账（challengeDone + coins）、结束挑战并返回事件供 toast。
 * 每秒 tick 调用一次即可；全部为轻量推导。
 */
export function checkChallenge(state: GameState): ChallengeDoneEvent[] {
  const events: ChallengeDoneEvent[] = [];
  const id = state.challenge.active;
  if (!id) return events;
  const def = CHALLENGES.find(c => c.id === id);
  if (!def) return events;
  state.challenge.progress = goalProgress(state);
  if (state.challenge.progress >= def.goal.target && !state.prestige.challengeDone.includes(id)) {
    state.prestige.challengeDone.push(id);
    state.prestige.coins += def.reward;
    state.challenge.active = null;
    state.challenge.progress = 0;
    events.push({ def, reward: def.reward });
  }
  return events;
}

/**
 * 激活挑战：需已解锁、未领过奖励、当前无激活中的挑战；
 * 激活时若带 startMoneyBonus 则立得资金（放弃不退回，防止刷钱）。
 */
export function startChallenge(state: GameState, id: string): ChallengeActionResult {
  const def = CHALLENGES.find(c => c.id === id);
  if (!def) return fail('未知挑战');
  if (state.challenge.active) return fail('已有挑战进行中，先完成或放弃当前挑战');
  if (state.prestige.challengeDone.includes(id)) return fail('该挑战已完成，奖励一次性发放');
  if (!challengeAvailable(state, id)) {
    const names = (def.requires ?? [])
      .filter(r => !state.prestige.challengeDone.includes(r))
      .map(r => CHALLENGES.find(c => c.id === r)?.name ?? r);
    return fail(`需先完成挑战：${names.join('、')}`);
  }
  state.challenge.active = id;
  state.challenge.progress = 0;
  let bonus = 0;
  if (def.mods.startMoneyBonus) {
    bonus = def.mods.startMoneyBonus;
    state.money += bonus;
  }
  return ok(`已激活挑战「${def.name}」${bonus ? `，获得起步资金 ¥${bonus}` : ''}！目标：${def.desc}`);
}

/** 放弃当前挑战：进度清零（已完成领过奖励的不受影响；已领的 startMoneyBonus 不退回） */
export function abandonChallenge(state: GameState): ChallengeActionResult {
  if (!state.challenge.active) return fail('当前没有进行中的挑战');
  const def = challengeDefById(state.challenge.active);
  state.challenge.active = null;
  state.challenge.progress = 0;
  return ok(`已放弃挑战「${def.name}」，可稍后重新激活`);
}

/** 购买挑战商店物品（挑战币支付；after 前置需 ≥1 级） */
export function buyChallengeShop(state: GameState, id: string): ChallengeActionResult {
  const def = challengeShopDefById(id);
  if (!challengeShopPrereqMet(state, def)) {
    return fail(`需先购买「${challengeShopDefById(def.after!).name}」1 级`);
  }
  const lv = challengeShopLevel(state, id);
  if (lv >= def.max) return fail('已满级');
  const cost = challengeShopCost(def, lv);
  if (state.prestige.coins < cost) return fail(`挑战币不够（需要 ${cost}）`);
  state.prestige.coins -= cost;
  state.prestige.shop[id] = lv + 1;
  return ok(`已升级「${def.name}」至 ${lv + 1} 级`);
}

/**
 * 挑战「款数上限」拦截：maxDistinctCopies 到限时拒绝获得「新款」桌游
 * （当前 copies 中不存在的 gameId）；已有款的加购副本放行。返回拒绝原因，null = 放行。
 */
export function distinctCapBlock(state: GameState, gameId: string): string | null {
  const max = challengeMods(state).maxDistinctCopies;
  if (max === undefined) return null;
  if (state.copies.some(c => c.gameId === gameId)) return null;
  if (distinctCopyKinds(state) >= max) {
    return `挑战限制：收藏架最多同时持有 ${max} 款不同桌游，请先出售腾位`;
  }
  return null;
}
