import type { Rarity } from './types';

// ================= 转生「退坑」调参区 =================
// 设计约束：一切与桌游清单/六维属性挂钩的数值都按「稀有度/动态数量」推导，
// 新增桌游或调整属性时无需改动本文件。

/** 精通权重（按稀有度） */
export const PRESTIGE_WEIGHT: Record<Rarity, number> = { N: 1, R: 2, SR: 4, SSR: 8 };
/** 隐藏款精通额外权重 */
export const PRESTIGE_HIDDEN_BONUS = 4;
/** 图鉴权重：每集齐 N 种已收藏桌游 +1 */
export const PRESTIGE_KIND_EVERY = 5;
/** 阅历收益系数：阅历 = round(sqrt(总权重) × 此系数) */
export const PRESTIGE_GAIN_MULT = 3;
/** 首次转生保底阅历 */
export const PRESTIGE_FIRST_GAIN = 10;
/** 解锁转生：精通数 ≥ max(基础值, 常规款总数 × 比例)（向上取整） */
export const PRESTIGE_UNLOCK_BASE = 8;
export const PRESTIGE_UNLOCK_RATIO = 0.2;

/** 天赋效果键：机制层按 key 读取乘区，新增天赋只需在此登记 + 在对应机制处挂钩 */
export type PerkKey =
  | 'fund' // 新周目开局资金
  | 'starterGift' // 开局三选一后额外随机送未收藏桌游
  | 'openExp' // 开箱经验奖励
  | 'pityCut' // 某赏保底抽数
  | 'masteryCut' // 精通门槛 -20%（收藏线封顶）
  | 'expAll' // 全属性经验
  | 'fatigueCut' // 疲劳增长
  | 'timeCut' // 游玩时长
  | 'offlineUp' // 离线收益折算
  | 'flow' // 心流：阶段开始按金区宽度自动命中（效率线封顶）
  | 'sellSlot' // 出售槽位（重置时生效）
  | 'sellBoost' // 某鱼成交率
  | 'tbDiscount' // 某宝价格
  | 'ticketUp' // 掉券率
  | 'sellHaste'; // 挂售判定提速 + 起始出售槽位 +3（商业线封顶）

export type PerkBranch = 'collect' | 'efficiency' | 'commerce';

export const PERK_BRANCH_NAME: Record<PerkBranch, string> = {
  collect: '📚 收藏线',
  efficiency: '⚡ 效率线',
  commerce: '💰 商业线',
};

export interface PerkDef {
  id: string;
  key: PerkKey;
  branch: PerkBranch;
  name: string;
  /** 效果说明（天赋页展示，含数值） */
  desc: string;
  max: number;
  /** 1 级价格（阅历）；cost = base + step × 当前等级 */
  base: number;
  step: number;
  /** 前置天赋 id：需先将其点到 ≥1 级才可学习（同线链式解锁；无前置 = 线首） */
  after?: string;
}

// 链式顺序即数组顺序：每条线从线首开始，逐个点 ≥1 级解锁后续；线尾为仅 1 级的封顶天赋。
export const PERKS: readonly PerkDef[] = [
  // 📚 收藏线
  { id: 'fund', key: 'fund', branch: 'collect', name: '启动资金', desc: '每级：新周目开局资金 +¥300', max: 5, base: 2, step: 1 },
  { id: 'gift', key: 'starterGift', branch: 'collect', name: '老友馈赠', desc: '每级：开局三选一后，额外随机获得一款尚未收藏的桌游', max: 3, base: 5, step: 3, after: 'fund' },
  { id: 'openexp', key: 'openExp', branch: 'collect', name: '开箱心得', desc: '每级：开箱经验奖励 +25%', max: 4, base: 3, step: 2, after: 'gift' },
  { id: 'pity', key: 'pityCut', branch: 'collect', name: '欧非守恒', desc: '每级：某赏保底所需抽数 -5', max: 2, base: 6, step: 4, after: 'openexp' },
  { id: 'masteryeye', key: 'masteryCut', branch: 'collect', name: '收藏家之眼', desc: '精通所需局数 -20%（N 16 / R 32 / SR 64 / SSR 128），加快转生循环与精通积累', max: 1, base: 15, step: 0, after: 'pity' },
  // ⚡ 效率线
  { id: 'expall', key: 'expAll', branch: 'efficiency', name: '触类旁通', desc: '每级：全部属性经验 ×1.1', max: 5, base: 3, step: 2 },
  { id: 'fatigue', key: 'fatigueCut', branch: 'efficiency', name: '科学作息', desc: '每级：游玩疲劳增长 -10%（沉浸下限之后继续生效）', max: 3, base: 4, step: 3, after: 'expall' },
  { id: 'time', key: 'timeCut', branch: 'efficiency', name: '熟门熟路', desc: '每级：游玩时长 -5%', max: 4, base: 4, step: 2, after: 'fatigue' },
  { id: 'offline', key: 'offlineUp', branch: 'efficiency', name: '挂机心得', desc: '每级：离线收益折算比例 +15%', max: 2, base: 5, step: 5, after: 'time' },
  { id: 'flow', key: 'flow', branch: 'efficiency', name: '心流', desc: '在线游玩每阶段开始时按金区宽度掷自动命中：命中则该阶段从 50% 进度直接开始、不出现金条（基础 20%，洞察每级 +1%）', max: 1, base: 15, step: 0, after: 'offline' },
  // 💰 商业线
  { id: 'sellslot', key: 'sellSlot', branch: 'commerce', name: '老主顾', desc: '每级：新周目起始出售槽位 +1（购买当周目立即 +1）', max: 2, base: 6, step: 5 },
  { id: 'sellboost', key: 'sellBoost', branch: 'commerce', name: '好口碑', desc: '每级：某鱼成交率 +10%', max: 3, base: 4, step: 3, after: 'sellslot' },
  { id: 'tbdiscount', key: 'tbDiscount', branch: 'commerce', name: '会员折扣', desc: '每级：某宝价格 -5%', max: 3, base: 4, step: 3, after: 'sellboost' },
  { id: 'ticketup', key: 'ticketUp', branch: 'commerce', name: '欧气满满', desc: '每级：抽赏券掉落率 +25%', max: 2, base: 4, step: 4, after: 'tbdiscount' },
  { id: 'hustle', key: 'sellHaste', branch: 'commerce', name: '商路亨通', desc: '某鱼挂售成交判定提速一倍（30 秒 → 15 秒）；新周目起始出售槽位 +3，且出售槽位上限 5 → 8（未点此天赋金钱最高只能扩到 5）', max: 1, base: 15, step: 0, after: 'ticketup' },
];

const PERK_MAP = new Map(PERKS.map(p => [p.id, p]));

export function perkDefById(id: string): PerkDef {
  const p = PERK_MAP.get(id);
  if (!p) throw new Error(`未知天赋 id: ${id}`);
  return p;
}
