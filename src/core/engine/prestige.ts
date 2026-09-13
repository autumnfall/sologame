import { SELL_SLOTS_MAX } from '../data/balance';
import { perkDefById } from '../data/prestige';
import { defaultState } from '../state';
import type { GameState } from '../state';
import { canPrestige, insightGain, insightSpent, perkCost, perkLevel, perkPrereqMet, prestigeUnlockCount } from '../mechanics/prestige';

export interface PrestigeResult {
  ok: boolean;
  reason?: string;
  /** 本次获得的阅历 */
  gain?: number;
}

/**
 * 退坑转生：清仓本周目的一切（金钱/收藏/实体/属性/槽位/保底/职业），
 * 保留阅历、天赋、生涯统计、成就（含已解锁的里程碑功能）与功能开关、玩家名/本地排行榜；
 * 获得阅历 = insightGain。返回全新开局状态（started=false，由 UI 重新走三选一与上架流程）。
 */
export function doPrestige(state: GameState): PrestigeResult {
  if (!canPrestige(state)) {
    return { ok: false, reason: `需要精通至少 ${prestigeUnlockCount()} 款桌游才能退坑` };
  }
  const gain = insightGain(state);
  const { insight, perks, runs } = state.prestige;
  const stats = state.stats;
  const achievements = state.achievements;
  const settings = state.settings;
  const playerName = state.playerName;
  const localBoard = state.localBoard;
  const clientId = state.clientId;
  const fresh = defaultState();
  Object.assign(state, fresh, {
    prestige: { insight: insight + gain, perks: { ...perks }, runs: runs + 1, lastGain: gain },
    stats,
    achievements,
    settings,
    playerName,
    localBoard,
    clientId,
    lastSeen: Date.now(),
  });
  // 注：天赋的开局加成（启动资金/老主顾起始槽位）在 pickStarter 选定开局时结算，
  // 这样转生后、开新周目前购买的天赋同样对本周目生效
  return { ok: true, gain };
}

/** 购买天赋（阅历支付；老主顾当周目立即 +1 出售槽位）；同线链式：需前置天赋 ≥1 级 */
export function buyPerk(state: GameState, id: string): { ok: boolean; reason?: string } {
  const def = perkDefById(id);
  if (!perkPrereqMet(state, def)) {
    return { ok: false, reason: `需先学习前置天赋「${perkDefById(def.after!).name}」1 级` };
  }
  const lv = perkLevel(state, id);
  if (lv >= def.max) return { ok: false, reason: '已满级' };
  const cost = perkCost(def, lv);
  if (state.prestige.insight < cost) return { ok: false, reason: `阅历不够（需要 ${cost}）` };
  state.prestige.insight -= cost;
  state.prestige.perks[id] = lv + 1;
  if (def.key === 'sellSlot') state.sellSlots = Math.min(SELL_SLOTS_MAX, state.sellSlots + 1);
  return { ok: true };
}

/** 洗点：全额退还已投入阅历（当周目已获得的出售槽位不回收，下周目按等级重算） */
export function respecPerks(state: GameState): { ok: boolean; reason?: string } {
  if (!Object.keys(state.prestige.perks).length) return { ok: false, reason: '尚未投资天赋' };
  state.prestige.insight += insightSpent(state);
  state.prestige.perks = {};
  state.stats.respecCount++;
  return { ok: true };
}
