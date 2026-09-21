// ================= 版本更新记录 =================
// 新条目在前：CHANGELOG[0] 即当前版本（页面页首展示用）。

export interface ChangelogEntry {
  version: string;   // 如 'v0.1'
  date: string;      // 如 '2026-09-21'
  sections: {
    feat?: string[];    // 功能增加
    adjust?: string[];  // 调整
    fix?: string[];     // bug 修复
  };
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: 'v0.1',
    date: '2026-09-21',
    sections: {
      feat: [
        '挑战场景系统：8 个三层前置挑战（无薪挑战 / 肝帝 / 捡漏之王 / 壮壮 / 硬核玩家 / 叉叉 / 花佬 / 柠檬佬），条件修饰持续整周目，完成一次性获得挑战币',
        '挑战币商店两条线：收藏线（博览群玩：全局经验；火眼金睛：某鱼好货概率）与设计线（灵感如泉 / 匠心独运 / 畅销作家，待桌游设计师玩法消费）',
        '版本更新页：记录每次版本的功能增加、调整与修复',
      ],
      adjust: [
        '挑战改为转生确认时选定、新周目开局生效：一周目仅一个、不可放弃，完成后修饰即释放（封堵周目内自由激活可攒资源秒完成的漏洞）',
      ],
    },
  },
];
