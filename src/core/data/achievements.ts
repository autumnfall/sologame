import type { GameState } from '../state';
import { copiesOf } from '../state';
import { GAMES, gamesByRarity } from './games';
import { attrLevel } from '../mechanics/attrs';
import { isMastered, kindCount, tierOwned } from '../mechanics/collection';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
}

const masteredN = (s: GameState) => GAMES.filter(g => isMastered(s, g.id)).length;
const hiddenOwned = (s: GameState) => GAMES.filter(g => g.hidden && s.collections[g.id]?.firstOpened).length;
const hiddenTotal = GAMES.filter(g => g.hidden).length;

/**
 * 成就表：每个达成即 +1% 全局经验（无上限）。
 * check 全部为轻量状态推导；事件类（保底触发、捡漏等）由引擎计数到 stats。
 * 新增成就只需在此登记，check 从现有状态推导即可。
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ---------- 收集线 ----------
  { id: 'first-game', name: '初次入手', desc: '获得第一款桌游', check: s => kindCount(s) >= 1 },
  { id: 'kinds-10', name: '小有规模', desc: '图鉴达到 10 种', check: s => kindCount(s) >= 10 },
  { id: 'kinds-25', name: '藏书家', desc: '图鉴达到 25 种', check: s => kindCount(s) >= 25 },
  { id: 'kinds-all', name: '全图鉴', desc: '集齐当前全部桌游（含隐藏款）', check: s => kindCount(s) >= GAMES.length },
  { id: 'tier-n', name: 'N 级集齐', desc: '开箱全部 N 级常规款', check: s => tierOwned(s, 'N') >= gamesByRarity('N').length },
  { id: 'tier-r', name: 'R 级集齐', desc: '开箱全部 R 级常规款', check: s => tierOwned(s, 'R') >= gamesByRarity('R').length },
  { id: 'tier-sr', name: 'SR 级集齐', desc: '开箱全部 SR 级常规款', check: s => tierOwned(s, 'SR') >= gamesByRarity('SR').length },
  { id: 'tier-ssr', name: 'SSR 级集齐', desc: '开箱全部 SSR 级常规款', check: s => tierOwned(s, 'SSR') >= gamesByRarity('SSR').length },
  { id: 'first-hidden', name: '隐藏款猎人', desc: '获得第一款隐藏款桌游', check: s => hiddenOwned(s) >= 1 },
  { id: 'hidden-all', name: '全隐藏', desc: '集齐全部隐藏款', check: s => hiddenOwned(s) >= hiddenTotal },
  { id: 'multi-copy', name: '多盒党', desc: '单款桌游同时拥有 3 盒实体', check: s => s.copies.some(c => s.copies.filter(x => x.gameId === c.gameId).length >= 3) },
  // ---------- 游玩线 ----------
  { id: 'first-play', name: '初体验', desc: '完成第一局游玩', check: s => s.stats.plays >= 1 },
  { id: 'plays-100', name: '百局老手', desc: '累计完成 100 局', check: s => s.stats.plays >= 100 },
  { id: 'plays-1000', name: '千局传说', desc: '累计完成 1000 局', check: s => s.stats.plays >= 1000 },
  { id: 'first-mastery', name: '精通大师', desc: '第一次精通一款桌游', check: s => masteredN(s) >= 1 },
  { id: 'mastery-10', name: '精通十款', desc: '精通 10 款桌游', check: s => masteredN(s) >= 10 },
  { id: 'mastery-all', name: '全精通', desc: '精通全部桌游', check: s => masteredN(s) >= GAMES.length },
  { id: 'hexagon', name: '六边形战士', desc: '六维属性全部达到 4 级', check: s => (Object.keys(s.attrExp) as (keyof GameState['attrExp'])[]).every(a => attrLevel(s, a) >= 4) },
  { id: 'worn-out', name: '物尽其用', desc: '把一盒桌游磨光（耐久归 0）', check: s => s.copies.some(c => c.durability <= 0) },
  { id: 'devoted', name: '一盒传世', desc: '单款桌游玩满 50 局', check: s => Object.values(s.collections).some(c => c.prof >= 50) },
  // ---------- 工作线 ----------
  { id: 'first-job', name: '打工人', desc: '第一次上岗工作', check: s => s.job !== null || s.stats.workCycles > 0 },
  { id: 'work-100', name: '职业生涯', desc: '累计完成 100 个工作周期', check: s => s.stats.workCycles >= 100 },
  { id: 'top-job', name: '巅峰职位', desc: '上岗「桌游设计师」', check: s => s.job === 'master' },
  // ---------- 商店线 ----------
  { id: 'tb-1', name: '某宝首单', desc: '第一次在某宝购买', check: s => s.stats.tbBought >= 1 },
  { id: 'xy-1', name: '某鱼首淘', desc: '第一次在某鱼淘货', check: s => s.stats.xyBought >= 1 },
  { id: 'pull-1', name: '某赏首抽', desc: '第一次抽赏', check: s => s.stats.pulls >= 1 },
  { id: 'first-ssr', name: '赏池欧洲人', desc: '抽出第一款 SSR 桌游', check: s => GAMES.some(g => g.rarity === 'SSR' && s.collections[g.id]?.firstOpened) },
  { id: 'pity-hit', name: '保底勇士', desc: '触发一次保底（50 抽无 SR 后必中）', check: s => s.stats.pityHits >= 1 },
  { id: 'first-sold', name: '黄牛初体验', desc: '某鱼第一次挂售成交', check: s => s.stats.soldCount >= 1 },
  { id: 'high-price', name: '高价成交', desc: '以 200% 定价成功卖出', check: s => s.stats.highPriceSold >= 1 },
  { id: 'bargain', name: '捡漏王', desc: '以不高于总价值 90% 的价格淘到货源', check: s => s.stats.bargainBuys >= 1 },
  { id: 'comeback', name: '回头客', desc: '卖掉唯一副本后又买回同款', check: s => s.stats.comeback === true },
  // ---------- 转生线 ----------
  { id: 'first-prestige', name: '第一次退坑', desc: '完成首次退坑转生', check: s => s.prestige.runs >= 1 },
  { id: 'prestige-3', name: '三朝元老', desc: '完成 3 次退坑转生', check: s => s.prestige.runs >= 3 },
  { id: 'first-perk', name: '天赋初见', desc: '第一次投资天赋', check: s => Object.keys(s.prestige.perks).length > 0 },
  { id: 'first-respec', name: '洗心革面', desc: '第一次洗点重分天赋', check: s => s.stats.respecCount >= 1 },
];

const ACH_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export function achievementById(id: string): AchievementDef {
  const a = ACH_MAP.get(id);
  if (!a) throw new Error(`未知成就 id: ${id}`);
  return a;
}

// ---------- 功能解锁（按已达成成就数里程碑） ----------

export type FeatureKey = 'autoFatigue' | 'tenPull' | 'sleeveAll' | 'listWorn' | 'autoMastery' | 'quickList';

export interface FeatureUnlock {
  key: FeatureKey;
  /** 达成成就数门槛 */
  need: number;
  name: string;
  desc: string;
}

export const FEATURE_UNLOCKS: readonly FeatureUnlock[] = [
  { key: 'autoFatigue', need: 5, name: '疲劳自动更换', desc: '连刷中当前游戏玩腻了，自动随机换一盒未疲劳的（可开关）' },
  { key: 'tenPull', need: 10, name: '十连抽', desc: '某赏支持一次消耗 10 倍金钱/券连抽十发' },
  { key: 'sleeveAll', need: 15, name: '一键套牌套', desc: '收藏架一键给所有未套实体套上牌套' },
  { key: 'listWorn', need: 20, name: '一键上架磨光件', desc: '某鱼一键把所有磨光实体按行情价上架' },
  { key: 'autoMastery', need: 25, name: '精通自动更换', desc: '连刷中当前游戏精通后，自动随机换一款未精通的（可开关）' },
  { key: 'quickList', need: 30, name: '某鱼快速上架', desc: '收藏架一键开关：开启后点「某鱼上架」直接按行情价上架（比例 50%~200% 可调，默认 100%），不再跳转某鱼页' },
];

/** 全部解锁所需成就数（最后一个里程碑） */
export const FEATURE_UNLOCK_MAX = Math.max(...FEATURE_UNLOCKS.map(f => f.need));

/** 未疲劳且可玩（自动更换目标共用条件） */
export function playableIds(s: GameState): string[] {
  return Object.keys(s.collections).filter(id =>
    s.collections[id].firstOpened && copiesOf(s, id).length > 0,
  );
}
