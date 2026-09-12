import type { Game, Rarity } from './types';
import { TIER_ORDER } from './constants';

// ===== N（提名 ≤4 票，毛线 / 入门）：单属性为主 =====
// baseExp 统一按 balance.ts 的 BASE_EXP_K × 时长^0.15 × 市价^0.4 取整（越贵/越长/越稀有越高）
const N_GAMES: Game[] = [
  { id: 'guoyuan', name: '果园', en: 'Orchard', bgg: 245654, rarity: 'N', marketPrice: 88, weight: 1.2, playTime: 15, setupTime: 2, tags: ['小盒', '德式'], attrs: ['演算'], baseExp: 13, icon: '🍎', cards: 36 },
  { id: 'zongming', name: '绝顶聪明', en: "That's Pretty Clever", bgg: 244522, rarity: 'N', marketPrice: 98, weight: 1.9, playTime: 30, setupTime: 3, tags: ['纸笔', '骰子'], attrs: ['应变'], baseExp: 16, icon: '🎲', cards: null },
  { id: 'kafei', name: '咖啡烘焙师', en: 'Coffee Roaster', bgg: 196680, rarity: 'N', marketPrice: 78, weight: 1.9, playTime: 30, setupTime: 4, tags: ['小盒', '袋bg'], attrs: ['运筹'], baseExp: 14, icon: '☕', cards: null },
  { id: 'zhitu', name: '王国制图师', en: 'Cartographers', bgg: 263918, rarity: 'N', marketPrice: 98, weight: 1.9, playTime: 45, setupTime: 3, tags: ['纸笔', '德式'], attrs: ['演算'], baseExp: 17, icon: '🗺️', cards: 33 },
  { id: 'kaska', name: '卡斯卡迪亚之旅', en: 'Cascadia', bgg: 295947, rarity: 'N', marketPrice: 138, weight: 1.8, playTime: 30, setupTime: 4, tags: ['纸笔', '德式'], attrs: ['演算'], baseExp: 18, icon: '🌲', cards: null },
  { id: 'shikong', name: '时空神探', en: 'Kronologic: Paris 1920', bgg: 402111, rarity: 'N', marketPrice: 128, weight: 2.3, playTime: 30, setupTime: 2, tags: ['解谜'], attrs: ['洞察'], baseExp: 17, icon: '🕵️', cards: null },
  // N 档唯一双属性例外（骰子缓冲）
  { id: 'boendi', name: '勃艮第城堡', en: 'The Castles of Burgundy', bgg: 84876, rarity: 'N', marketPrice: 288, weight: 3.0, playTime: 70, setupTime: 7, tags: ['德式'], attrs: ['谋略', '应变'], baseExp: 27, icon: '🏰', cards: null },
  { id: 'xueyuan', name: '血源诅咒', en: 'Bloodborne: The Board Game', bgg: 273330, rarity: 'N', marketPrice: 899, weight: 3.5, playTime: 90, setupTime: 12, tags: ['大盒', '美式'], attrs: ['沉浸'], baseExp: 45, icon: '🩸', cards: 200 },
  { id: 'xuankong', name: '虚空降临', en: 'Voidfall', bgg: 357627, rarity: 'N', marketPrice: 598, weight: 4.5, playTime: 120, setupTime: 15, tags: ['德式'], attrs: ['谋略'], baseExp: 40, icon: '🌌', cards: 300 },
  { id: 'jilu', name: '姬路城', en: 'The White Castle', bgg: 371942, rarity: 'N', marketPrice: 218, weight: 2.6, playTime: 45, setupTime: 5, tags: ['德式'], attrs: ['运筹'], baseExp: 23, icon: '🏯', cards: 90 },
  { id: 'anake', name: '阿纳克遗迹', en: 'Lost Ruins of Arnak', bgg: 312484, rarity: 'N', marketPrice: 328, weight: 3.1, playTime: 90, setupTime: 10, tags: ['德式'], attrs: ['运筹'], baseExp: 30, icon: '🗿', cards: 150 },
  { id: 'xingkong', name: '星空觅迹', en: 'SETI: Search for Extraterrestrial Intelligence', bgg: 418059, rarity: 'N', marketPrice: 288, weight: 2.9, playTime: 90, setupTime: 6, tags: ['德式'], attrs: ['谋略'], baseExp: 28, icon: '🔭', cards: 200 },
  // N 隐藏款
  { id: 'hezou', name: '黑色奏鸣曲', en: 'Black Sonata', bgg: 249259, rarity: 'N', marketPrice: 198, weight: 2.2, playTime: 45, setupTime: 5, tags: ['小盒', '解谜'], attrs: ['洞察'], baseExp: 22, icon: '🎻', hidden: true, cards: 30, affix: { type: 'ticketUp', val: 0.25, desc: '抽赏券掉率 +25%' } },
  // ===== R（提名 5~9 票）：双属性为主 =====
  { id: 'yueliang', name: '欢迎来到月球', en: 'Welcome to the Moon', bgg: 339789, rarity: 'R', marketPrice: 128, weight: 2.1, playTime: 25, setupTime: 3, tags: ['纸笔'], attrs: ['演算', '谋略'], baseExp: 19, icon: '🌕', cards: null },
  { id: 'manwei', name: '漫威LCG', en: 'Marvel Champions: The Card Game', bgg: 285774, rarity: 'R', marketPrice: 298, weight: 2.9, playTime: 60, setupTime: 10, tags: ['lcg'], attrs: ['沉浸', '运筹'], baseExp: 31, icon: '🦸', cards: 350 },
  { id: 'toumi', name: '骰谜奇境', en: 'Roll Player Adventures', bgg: 331787, rarity: 'R', marketPrice: 488, weight: 3.4, playTime: 120, setupTime: 10, tags: ['大盒', '美式', '传承'], attrs: ['应变', '沉浸'], baseExp: 41, icon: '📜', cards: 200 },
  { id: 'zonglvdao', name: '棕榈岛', en: 'Palm Island', bgg: 239464, rarity: 'R', marketPrice: 68, weight: 1.6, playTime: 15, setupTime: 1, tags: ['小盒'], attrs: ['运筹', '应变'], baseExp: 14, icon: '🏝️', cards: 48 },
  { id: 'fende', name: '奋进号：深海', en: 'Endeavor: Deep Sea', bgg: 367966, rarity: 'R', marketPrice: 368, weight: 2.8, playTime: 75, setupTime: 8, tags: ['德式'], attrs: ['谋略', '演算'], baseExp: 35, icon: '🚢', cards: 150 },
  { id: 'guyong', name: '孤勇英豪', en: 'Unstoppable', bgg: 420498, rarity: 'R', marketPrice: 268, weight: 2.8, playTime: 45, setupTime: 6, tags: ['美式', 'dbg'], attrs: ['应变', '运筹'], baseExp: 28, icon: '⚔️', cards: 120 },
  { id: 'mori', name: '末日决战', en: "Aeon's End", bgg: 191189, rarity: 'R', marketPrice: 328, weight: 3.1, playTime: 60, setupTime: 8, tags: ['美式', 'dbg'], attrs: ['运筹', '应变'], baseExp: 32, icon: '🌀', cards: 400 },
  { id: 'dasoucha', name: '大搜查系列', en: 'Unlock!', bgg: 213460, rarity: 'R', marketPrice: 158, weight: 2.5, playTime: 60, setupTime: 2, tags: ['解谜'], attrs: ['洞察', '演算'], baseExp: 24, icon: '🔍', cards: 60 },
  // R 隐藏款
  { id: 'diguo', name: '帝国：经典', en: 'Imperium: Classics', bgg: 318184, rarity: 'R', marketPrice: 388, weight: 3.4, playTime: 90, setupTime: 8, tags: ['德式', 'dbg'], attrs: ['谋略', '运筹'], baseExp: 36, icon: '🏺', hidden: true, cards: 280, affix: { type: 'timeCut', val: 0.10, desc: '游玩时长 -10%' } },
  // ===== SR（提名 10~20 票）：三属性为主 =====
  { id: 'tigemei', name: '提戈梅公会', en: 'The Guild of Merchant Explorers', bgg: 350933, rarity: 'SR', marketPrice: 258, weight: 2.7, playTime: 45, setupTime: 6, tags: ['纸笔', '德式'], attrs: ['演算', '运筹', '洞察'], baseExp: 31, icon: '🧭', cards: 50 },
  { id: 'haigu', name: '骸骨险境', en: 'Too Many Bones', bgg: 192135, rarity: 'SR', marketPrice: 1099, weight: 3.9, playTime: 90, setupTime: 10, tags: ['美式'], attrs: ['应变', '沉浸', '运筹'], baseExp: 61, icon: '💀', cards: 100 },
  { id: 'jueming', name: '绝命少女', en: 'Final Girl', bgg: 329591, rarity: 'SR', marketPrice: 268, weight: 2.9, playTime: 60, setupTime: 8, tags: ['美式', '骰子'], attrs: ['应变', '沉浸', '洞察'], baseExp: 33, icon: '🔪', cards: 200 },
  { id: 'ziran', name: '自然和弦', en: 'Harmonies', bgg: 343147, rarity: 'SR', marketPrice: 228, weight: 2.1, playTime: 40, setupTime: 4, tags: ['德式'], attrs: ['演算', '谋略', '应变'], baseExp: 29, icon: '🍂', cards: null },
  { id: 'luoma', name: '罗马：帝国的命运', en: 'Rome: Fate of an Empire', bgg: 303873, rarity: 'SR', marketPrice: 298, weight: 3.2, playTime: 75, setupTime: 8, tags: ['德式', 'dbg'], attrs: ['运筹', '谋略', '洞察'], baseExp: 35, icon: '🏛️', cards: 100 },
  { id: 'hadeliang', name: '哈德良长城', en: "Hadrian's Wall", bgg: 304783, rarity: 'SR', marketPrice: 268, weight: 3.2, playTime: 60, setupTime: 6, tags: ['纸笔', '德式'], attrs: ['演算', '谋略', '运筹'], baseExp: 33, icon: '🧱', cards: null },
  { id: 'moling', name: '魔戒LCG', en: 'The Lord of the Rings: The Card Game', bgg: 77423, rarity: 'SR', marketPrice: 328, weight: 3.1, playTime: 60, setupTime: 12, tags: ['lcg'], attrs: ['沉浸', '运筹', '谋略'], baseExp: 36, icon: '💍', cards: 350 },
  { id: 'aleb', name: '阿勒农场', en: 'Fields of Arle', bgg: 159675, rarity: 'SR', marketPrice: 498, weight: 3.9, playTime: 100, setupTime: 12, tags: ['德式'], attrs: ['谋略', '运筹', '演算'], baseExp: 45, icon: '🚜', cards: 180 },
  { id: 'beijing', name: '为了北境森林', en: 'For Northwood! A Solo Trick-Taking Game', bgg: 334590, rarity: 'SR', marketPrice: 108, weight: 1.8, playTime: 20, setupTime: 3, tags: ['小盒', '吃墩'], attrs: ['应变', '谋略', '沉浸'], baseExp: 19, icon: '🦊', cards: 80 },
  // SR 隐藏款
  { id: 'ershiqiang', name: '20强', en: '20 Strong', bgg: 373167, rarity: 'SR', marketPrice: 298, weight: 2.5, playTime: 30, setupTime: 4, tags: ['小盒', '美式', '骰子'], attrs: ['应变', '谋略', '洞察'], baseExp: 31, icon: '🎯', hidden: true, cards: 30, affix: { type: 'fatHalf', val: 1, desc: '游玩疲劳增长减半' } },
  // ===== SSR（提名 ≥21 票）：四属性为主 =====
  { id: 'lingji', name: '灵迹岛', en: 'Spirit Island', bgg: 162886, rarity: 'SSR', marketPrice: 598, weight: 4.1, playTime: 120, setupTime: 12, tags: ['美式'], attrs: ['谋略', '沉浸', '应变', '运筹'], baseExp: 53, icon: '🌋', cards: 200 },
  { id: 'aoding', name: '奥丁的盛宴', en: 'A Feast for Odin', bgg: 177736, rarity: 'SSR', marketPrice: 698, weight: 3.9, playTime: 90, setupTime: 12, tags: ['德式'], attrs: ['演算', '运筹', '谋略', '应变'], baseExp: 54, icon: '🍖', cards: 180 },
  { id: 'fangzhou', name: '方舟动物园', en: 'Ark Nova', bgg: 342942, rarity: 'SSR', marketPrice: 688, weight: 3.7, playTime: 120, setupTime: 10, tags: ['德式'], attrs: ['谋略', '运筹', '演算', '洞察'], baseExp: 56, icon: '🦁', cards: 250 },
  { id: 'guizhen', name: '诡镇奇谈LCG', en: 'Arkham Horror: The Card Game', bgg: 205637, rarity: 'SSR', marketPrice: 358, weight: 3.4, playTime: 90, setupTime: 15, tags: ['lcg'], attrs: ['沉浸', '洞察', '应变', '运筹'], baseExp: 41, icon: '🐙', cards: 300 },
  // SSR 隐藏款（唯一六维全修——什么机制都有）
  { id: 'mofa', name: '魔法骑士：终极版', en: 'Mage Knight: Ultimate Edition', bgg: 248562, rarity: 'SSR', marketPrice: 999, weight: 4.4, playTime: 150, setupTime: 15, tags: ['德式', 'dbg'], attrs: ['谋略', '演算', '应变', '运筹', '洞察', '沉浸'], baseExp: 67, icon: '🐉', hidden: true, cards: 400, affix: { type: 'expAll', val: 0.05, desc: '全属性经验 +5%' } },
];

export const GAMES: readonly Game[] = N_GAMES;

/** 常规款（非隐藏） */
export const REGULAR_GAMES: readonly Game[] = GAMES.filter(g => !g.hidden);

const GMAP = new Map(GAMES.map(g => [g.id, g]));

export function gameById(id: string): Game {
  const g = GMAP.get(id);
  if (!g) throw new Error(`未知桌游 id: ${id}`);
  return g;
}

export function gamesByRarity(rarity: Rarity): readonly Game[] {
  return REGULAR_GAMES.filter(g => g.rarity === rarity);
}

/** 稀有度的下一级（SSR 返回 null） */
export function nextTier(rarity: Rarity): Rarity | null {
  const i = TIER_ORDER.indexOf(rarity);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}
