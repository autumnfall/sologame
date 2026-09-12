import { describe, expect, it } from 'vitest';
import {
  MASTERY, SAVE_VERSION,
  acquireGame, achievementExpMult, achievedCount, applySleeve, autoSwitchTarget,
  buyPerk, buyTaobao, buyXianyu, checkAchievements, defaultState, doPrestige,
  expandSellSlots, expMult, isFeatureUnlocked, listCopy, listWornCopies,
  parseSave, respecPerks, settleRound, sleeveAll, tickXianyu,
} from '../src/core';
import { open, own } from './helpers';
import type { GameState } from '../src/core';

describe('成就：扫描与经验加成', () => {
  it('checkAchievements：达成即入账，重复扫描不重复计算', () => {
    const s = defaultState();
    expect(checkAchievements(s)).toHaveLength(0);
    own(s, 'guoyuan');
    const fresh = checkAchievements(s);
    expect(fresh.map(a => a.id)).toContain('first-game');
    expect(achievedCount(s)).toBe(fresh.length);
    expect(checkAchievements(s)).toHaveLength(0); // 幂等
  });

  it('事件类成就：游玩/某宝购买/某鱼淘货等计数触发', () => {
    const s = defaultState();
    s.money = 99999;
    initStock(s);
    buyTaobao(s, 'guoyuan');
    const c = own(s, 'zongming');
    settleRound(s, 'zongming', c.uid, 1, () => 0.99);
    const ids = checkAchievements(s).map(a => a.id);
    expect(ids).toContain('tb-1');
    expect(ids).toContain('first-play');
    expect(s.stats.tbBought).toBe(1);
  });

  it('经验加成：每成就 +1% 且不设上限', () => {
    const s = defaultState();
    expect(achievementExpMult(s)).toBe(1);
    s.achievements = ['a', 'b', 'c'];
    expect(achievementExpMult(s)).toBeCloseTo(1.03, 10);
    s.achievements = Array.from({ length: 200 }, (_, i) => `fake-${i}`);
    expect(achievementExpMult(s)).toBeCloseTo(3.0, 10); // 无上限
  });
});

describe('成就：功能里程碑解锁', () => {
  it('5/10/15/20/25 逐级解锁', () => {
    const s = defaultState();
    const n = (k: number) => Array.from({ length: k }, (_, i) => `fake-${i}`);
    expect(isFeatureUnlocked(s, 'autoFatigue')).toBe(false);
    s.achievements = n(5);
    expect(isFeatureUnlocked(s, 'autoFatigue')).toBe(true);
    expect(isFeatureUnlocked(s, 'tenPull')).toBe(false);
    s.achievements = n(10);
    expect(isFeatureUnlocked(s, 'tenPull')).toBe(true);
    s.achievements = n(15);
    expect(isFeatureUnlocked(s, 'sleeveAll')).toBe(true);
    s.achievements = n(20);
    expect(isFeatureUnlocked(s, 'listWorn')).toBe(true);
    s.achievements = n(25);
    expect(isFeatureUnlocked(s, 'autoMastery')).toBe(true);
    expect(isFeatureUnlocked(s, 'quickList')).toBe(false);
    s.achievements = n(30);
    expect(isFeatureUnlocked(s, 'quickList')).toBe(true);
  });

  it('expMult 吃成就加成（挂钩验证）', () => {
    const s = defaultState();
    const base = expMult(s);
    s.achievements = ['x'];
    expect(expMult(s)).toBeCloseTo(base * 1.01, 10);
  });
});

describe('成就：自动更换目标', () => {
  it('疲劳模式：排除当前与已疲劳，随机取未疲劳候选', () => {
    const s = defaultState();
    own(s, 'guoyuan'); // 当前，疲劳 0
    own(s, 'zongming', { fatigue: 8 }); // 已疲劳
    own(s, 'kafei', { fatigue: 3 });
    expect(autoSwitchTarget(s, 'fatigue', 'guoyuan', () => 0)).toBe('kafei');
    // 排除当前后仍有未疲劳候选（guoyuan）
    expect(autoSwitchTarget(s, 'fatigue', 'kafei', () => 0)).toBe('guoyuan');
    // 全部候选都疲劳 → null
    const s2 = defaultState();
    own(s2, 'guoyuan'); // 当前
    own(s2, 'zongming', { fatigue: 8 });
    expect(autoSwitchTarget(s2, 'fatigue', 'guoyuan', () => 0)).toBeNull();
  });

  it('精通模式：排除已精通', () => {
    const s = defaultState();
    own(s, 'guoyuan', { prof: MASTERY.N }); // 已精通（且为当前）
    own(s, 'zongming');
    expect(autoSwitchTarget(s, 'mastery', 'guoyuan', () => 0)).toBe('zongming');
  });
});

describe('成就：一键操作', () => {
  it('一键套牌套：逐盒扣牌套、跳过已套/上架/无卡牌', () => {
    const s = defaultState();
    own(s, 'guoyuan'); // 36 张
    own(s, 'guoyuan'); // 36 张
    own(s, 'zongming'); // 无卡牌
    s.sleeves = 40; // 只够一盒
    const r = sleeveAll(s);
    expect(r.count).toBe(1);
    expect(r.used).toBe(36);
    expect(s.sleeves).toBe(4);
    expect(s.copies.filter(c => c.sleeved)).toHaveLength(1);
    // 牌套足够时全套
    const s2 = defaultState();
    own(s2, 'guoyuan');
    own(s2, 'zhitu'); // 33 张
    s2.sleeves = 100;
    expect(sleeveAll(s2).count).toBe(2);
    // 与 applySleeve 等价
    expect(applySleeve(s2, s2.copies[0].uid).ok).toBe(false); // 已套
  });

  it('一键上架磨光件：仅耐久 0、占满槽位为止、按 100% 定价', () => {
    const s = defaultState();
    const worn = own(s, 'guoyuan', { durability: 0 });
    own(s, 'guoyuan'); // 满耐久不上
    own(s, 'kafei', { durability: 0 });
    s.money = 999;
    expandSellSlots(s); // 2 槽
    const r = listWornCopies(s);
    expect(r.count).toBe(2);
    expect(s.listings).toHaveLength(2);
    expect(s.listings.every(l => l.price > 0)).toBe(true);
    expect(worn.durability).toBe(0);
    expect(listWornCopies(s).count).toBe(0); // 幂等
  });
});

describe('成就：事件计数器', () => {
  it('某鱼：购买计数、捡漏判定、成交计数与 200% 高价、回头客标记', () => {
    const s = defaultState();
    s.money = 99999;
    s.xianyuBuys = [{ gameId: 'mori', price: 100, durability: 20, sleeved: false, stored: false }];
    const r = buyXianyu(s, 0);
    expect(r.ok).toBe(true);
    expect(s.stats.xyBought).toBe(1);
    expect(s.stats.bargainBuys).toBe(1); // mori 价值远超 100/0.9
    // 挂售唯一副本 → 成交 → resold 标记 → 买回 → comeback
    const uid = s.copies.find(c => c.gameId === 'mori')!.uid;
    expect(listCopy(s, uid, 2.0).ok).toBe(true); // 200% 定价
    s.xySellNext = 1;
    const sold = tickXianyu(s, () => 0.0, 100); // 0耐久? mori 耐久 20 → chance>0 且 rng 0 必中
    expect(sold.sold).toHaveLength(1);
    expect(s.stats.soldCount).toBe(1);
    expect(s.stats.highPriceSold).toBe(1);
    expect(s.collections['mori'].resold).toBe(true);
    expect(s.stats.comeback).toBe(false);
    acquireGame(s, 'mori');
    expect(s.stats.comeback).toBe(true);
    expect(s.collections['mori'].resold).toBe(false);
    const ids = checkAchievements(s).map(a => a.id);
    expect(ids).toContain('comeback');
    expect(ids).toContain('first-sold');
    expect(ids).toContain('high-price');
    expect(ids).toContain('bargain');
    expect(ids).toContain('xy-1');
  });

  it('洗点计数', () => {
    const s = defaultState();
    s.prestige.insight = 10;
    buyPerk(s, 'fund');
    respecPerks(s);
    expect(s.stats.respecCount).toBe(1);
    expect(checkAchievements(s).map(a => a.id)).toContain('first-respec');
  });

  it('转生保留成就与设置', () => {
    const s = defaultState();
    for (let i = 0; i < 8; i++) open(s, ['guoyuan', 'zongming', 'kafei', 'zhitu', 'kaska', 'shikong', 'boendi', 'xueyuan'][i], { prof: MASTERY.N });
    s.achievements = ['a', 'b'];
    s.settings.autoSwitch = 'fatigue';
    expect(doPrestige(s).ok).toBe(true);
    expect(s.achievements).toEqual(['a', 'b']);
    expect(s.settings.autoSwitch).toBe('fatigue');
  });
});

describe('成就：存档迁移', () => {
  it('v8 → v9：补 achievements/settings 与计数器；resold 归一化', () => {
    const v8 = {
      saveVersion: 8,
      money: 100, stats: { plays: 3, pulls: 1 },
      collections: { guoyuan: { firstOpened: true, prof: 1, fatigue: 2, rulesRead: true, resold: true } },
    };
    const s = parseSave(JSON.stringify(v8));
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.achievements).toEqual([]);
    expect(s!.settings.autoSwitch).toBe('off');
    expect(s!.stats.plays).toBe(3);
    expect(s!.stats.tbBought).toBe(0);
    expect(s!.collections['guoyuan'].resold).toBe(true);
  });

  it('v9 → v10：实体锁定与快速上架开关归一化', () => {
    const v9 = {
      saveVersion: 9,
      money: 100,
      collections: { guoyuan: { firstOpened: true, prof: 1, fatigue: 2, rulesRead: true } },
      copies: [
        { uid: 1, gameId: 'guoyuan', durability: 5, sleeved: false, stored: false, locked: true },
        { uid: 2, gameId: 'guoyuan', durability: 5, sleeved: false, stored: false },
      ],
      settings: { autoSwitch: 'fatigue', quickList: true },
    };
    const s = parseSave(JSON.stringify(v9));
    expect(s).not.toBeNull();
    expect(s!.saveVersion).toBe(SAVE_VERSION);
    expect(s!.copies[0].locked).toBe(true);
    expect(s!.copies[1].locked).toBeUndefined();
    expect(s!.settings.autoSwitch).toBe('fatigue');
    expect(s!.settings.quickList).toBe(true);
  });
});

function initStock(s: GameState) {
  // 与引擎 initTaobaoStock 等效的最小实现：直接写满 N 级库存
  for (const id of ['guoyuan', 'zongming', 'kafei', 'zhitu']) s.taobaoStock[id] = 4;
}
