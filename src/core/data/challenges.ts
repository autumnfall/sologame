// ================= 挑战场景调参区 =================
// 挑战 = 条件修饰 + 目标；完成后一次性发放挑战币（prestige.challengeDone 记录，跨周目保留）。
// 设计师向商店加成（灵感/评分/版税）在 Phase 2 才消费，Phase 1 只定义数据与购买。

/** 挑战目标类型：goalProgress 按 type 从 stats / 收藏推导当前进度 */
export type GoalType =
  | 'xyEarn'              // 某鱼卖出净额累计
  | 'bargainBuys'         // 捡漏次数
  | 'masteryCount'        // 已精通桌游款数
  | 'plays'               // 游玩局数
  | 'highPriceSold'       // 200% 定价成交次数
  | 'pulls'               // 抽赏次数
  | 'distinctCopies'      // 架上存在实体的不同桌游款数
  | 'distinctCollections'; // 已开图鉴的收藏款数（卖光也算）

/** 挑战条件修饰：全部为可选乘区/开关，机制层按 key 读取，新增挑战只改本文件 */
export interface ChallengeMods {
  /** 禁用工作收入（在线 + 离线均不发薪，周期照常推进） */
  noJobIncome?: boolean;
  /** 某鱼刷新间隔倍率（<1 更快） */
  xyRefreshMult?: number;
  /** 某鱼到货件数倍率 */
  xyCountMult?: number;
  /** 六维经验倍率 */
  expMult?: number;
  /** 疲劳增长倍率（>1 更快疲劳） */
  fatigueIncMult?: number;
  /** 某赏价格倍率（>1 更贵；常驻池与桌游池金钱支付） */
  gachaPriceMult?: number;
  /** 禁止游玩（在线主动开局 + 离线自动游玩全禁） */
  noPlay?: boolean;
  /** 收藏架最多可同时持有多少款不同桌游的实体；到上限后拒绝获得「新款」（已有款加购副本不受影响） */
  maxDistinctCopies?: number;
  /** 新周目开局时立得资金（转生生效时发放） */
  startMoneyBonus?: number;
  /** 某鱼成交率倍率 */
  sellChanceMult?: number;
}

export interface ChallengeDef {
  id: string;
  name: string;
  desc: string;
  /** 前置：需已完成这些挑战（空/缺省 = 第一层，开局即可激活） */
  requires?: string[];
  mods: ChallengeMods;
  goal: { type: GoalType; target: number };
  /** 挑战币（一次性） */
  reward: number;
}

/** 挑战树（三层）：币供给合计 22，商店升满 20（余 2 币，受前置链约束按序投资） */
export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'no-salary', name: '无薪挑战', desc: '全靠倒买倒卖生活：没有任何工作收入，靠某鱼卖出净额 ¥2000。',
    mods: { noJobIncome: true },
    goal: { type: 'xyEarn', target: 2000 }, reward: 2,
  },
  {
    id: 'marathon', name: '肝帝', desc: '疲劳增长 ×1.5，硬肝 100 局。',
    mods: { fatigueIncMult: 1.5 },
    goal: { type: 'plays', target: 100 }, reward: 2,
  },
  {
    id: 'flea-market', name: '捡漏之王', desc: '某鱼刷新间隔减半、到货翻倍，捡漏 5 次。',
    requires: ['no-salary'],
    mods: { xyRefreshMult: 0.5, xyCountMult: 2 },
    goal: { type: 'bargainBuys', target: 5 }, reward: 2,
  },
  {
    id: 'merchant', name: '壮壮', desc: '某鱼到货减半，200% 定价高价成交 10 次。',
    requires: ['no-salary'],
    mods: { xyCountMult: 0.5 },
    goal: { type: 'highPriceSold', target: 10 }, reward: 3,
  },
  {
    id: 'hardcore', name: '硬核玩家', desc: '六维经验 ×0.6 的逆境中精通 3 款桌游。',
    requires: ['marathon'],
    mods: { expMult: 0.6 },
    goal: { type: 'masteryCount', target: 3 }, reward: 3,
  },
  {
    id: 'big-earner', name: '叉叉', desc: '架上最多 5 款不同桌游（买新款→开图鉴→卖掉腾位），某鱼成交率 ×1.2，图鉴收藏 20 款。',
    requires: ['flea-market', 'merchant'],
    mods: { maxDistinctCopies: 5, sellChanceMult: 1.2 },
    goal: { type: 'distinctCollections', target: 20 }, reward: 4,
  },
  {
    id: 'collector', name: '花佬', desc: '不可游玩桌游（补偿起步资金 +¥1000），纯收藏 30 款不同桌游实体。',
    requires: ['hardcore'],
    mods: { noPlay: true, startMoneyBonus: 1000 },
    goal: { type: 'distinctCopies', target: 30 }, reward: 4,
  },
  {
    id: 'whale', name: '柠檬佬', desc: '某赏价格 ×1.5 的豪掷：抽赏 100 次。',
    requires: ['hardcore'],
    mods: { gachaPriceMult: 1.5 },
    goal: { type: 'pulls', target: 100 }, reward: 2,
  },
];

/** 挑战商店效果键：机制层按 key 读取乘区（设计线三件 Phase 2 才消费） */
export type ChallengeShopKey =
  | 'expBoost'   // 全局经验 +5%/级（收藏线）
  | 'xyEye'      // 某鱼好货（高成色/带牌套）概率 +8%/级（收藏线）
  | 'inspUp'     // 灵感获取 +15%/级（设计线，Phase 2 消费）
  | 'scoreUp'    // 设计评分 +8%/级（设计线，Phase 2 消费）
  | 'royaltyUp'; // 版税率 +12%/级（设计线，Phase 2 消费）

export type ChallengeShopLine = 'collect' | 'design';

export const CHALLENGE_SHOP_LINE_NAME: Record<ChallengeShopLine, string> = {
  collect: '📚 收藏线',
  design: '🎨 设计线',
};

export interface ChallengeShopDef {
  id: string;
  key: ChallengeShopKey;
  line: ChallengeShopLine;
  name: string;
  /** 效果说明（挑战页展示，含数值） */
  desc: string;
  max: number;
  /** 1 级价格（挑战币）；cost = base + step × 当前等级 */
  base: number;
  step: number;
  /** 前置物品 id：需先将其点到 ≥1 级才可购买 */
  after?: string;
}

// 合计 20 币（5+3+5+4+3）；全部 base=1、step=0，每级 1 币。
export const CHALLENGE_SHOP: readonly ChallengeShopDef[] = [
  { id: 'exp-boost', key: 'expBoost', line: 'collect', name: '博览群玩', desc: '每级：全局经验 +5%（与图鉴/谋略等乘区并列相乘）', max: 5, base: 1, step: 0 },
  { id: 'xy-eye', key: 'xyEye', line: 'collect', name: '火眼金睛', desc: '每级：某鱼好货概率 +8%（带牌套概率提升、成色下限上移）', max: 3, base: 1, step: 0, after: 'exp-boost' },
  { id: 'insp-up', key: 'inspUp', line: 'design', name: '灵感如泉', desc: '每级：灵感获取 +15%（桌游设计师玩法，后续版本生效）', max: 5, base: 1, step: 0 },
  { id: 'score-up', key: 'scoreUp', line: 'design', name: '匠心独运', desc: '每级：设计评分 +8%（桌游设计师玩法，后续版本生效）', max: 4, base: 1, step: 0, after: 'insp-up' },
  { id: 'royalty-up', key: 'royaltyUp', line: 'design', name: '畅销作家', desc: '每级：版税率 +12%（桌游设计师玩法，后续版本生效）', max: 3, base: 1, step: 0, after: 'score-up' },
];

const CHALLENGE_MAP = new Map(CHALLENGES.map(c => [c.id, c]));
const SHOP_MAP = new Map(CHALLENGE_SHOP.map(p => [p.id, p]));

export function challengeDefById(id: string): ChallengeDef {
  const c = CHALLENGE_MAP.get(id);
  if (!c) throw new Error(`未知挑战 id: ${id}`);
  return c;
}

export function challengeShopDefById(id: string): ChallengeShopDef {
  const p = SHOP_MAP.get(id);
  if (!p) throw new Error(`未知挑战商店 id: ${id}`);
  return p;
}
