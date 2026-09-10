// ---------- 基础类型 ----------

/** 稀有度阶梯：N < R < SR < SSR */
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

/** 隐藏款词条类型（affix.type） */
export type AffixType = 'ticketUp' | 'timeCut' | 'fatHalf' | 'expAll';

export interface Affix {
  type: AffixType;
  val: number;
  desc: string;
}

/** 桌游条目（源自 solo 提名表；稀有度按提名票数分段映射） */
export interface Game {
  id: string;
  name: string;
  /** 英文原名 */
  en: string;
  /** BGG 编号 */
  bgg: number;
  rarity: Rarity;
  /** 市场价（元） */
  marketPrice: number;
  /** 复杂度（BGG weight） */
  weight: number;
  /** 基础游玩时长（分钟） */
  playTime: number;
  /** 基础 Setup 时长（分钟） */
  setupTime: number;
  tags: string[];
  /** 加成属性（1~6 个，经验按 EXP_SHARES 分摊） */
  attrs: import('./constants').Attr[];
  /** 每局基础经验 */
  baseExp: number;
  icon: string;
  /** 隐藏款：商店不卖、某赏不出，仅某鱼小概率刷出；不计入解锁下一级的收集要求 */
  hidden?: boolean;
  /**
   * 卡牌张数（估算值，后续用 BGG sleeves 页真值替换；null = 无卡牌，不可套牌套）
   */
  cards: number | null;
  affix?: Affix;
}

/** 职业条目（周期制：每 cycleSec 秒自动结算一次 cyclePay，与游玩并行） */
export interface Job {
  id: string;
  name: string;
  /** 属性门槛：属性等级（罗马数字级别） */
  req: Partial<Record<import('./constants').Attr, number>>;
  /** 是否自动产生周期收入（试玩员为手动：游玩结算给钱） */
  auto: boolean;
  /** 工作周期（秒）；0 = 无周期（试玩员） */
  cycleSec: number;
  /** 每周期酬劳（元）；volatile 职业在结算时按沉浸下限~1.5 波动 */
  cyclePay: number;
  /** 酬劳波动（主播带货：结算时掷 ±） */
  volatile?: boolean;
  desc: string;
}
