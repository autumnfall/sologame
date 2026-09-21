# 挑战场景 + 桌游设计师 设计文档（数值定稿）

本文档是两个新系统（挑战场景 / 桌游设计师）的数值与结构定稿。后续代码以本文为准。
对应存档版本：**v12 → v13（挑战场景）**；设计师玩法为 Phase 2（v13 → v14，**未实现**）。

## 一、挑战场景

### 1. 结构

- 挑战按**三层前置树**解锁（仿天赋树 `after` 链）：`requires` 列出的挑战全部完成后才可激活。
- 周目内**同时只能激活一个挑战**；激活后其「条件修饰」立即生效（在线 + 离线一致）。
- 达成目标 → 获得**挑战币**（一次性，`prestige.challengeDone` 记录，跨周目保留）→ 挑战自动结束。
- 激活后可随时**放弃**（进度清零；已领过的 `startMoneyBonus` 不退，防止刷钱）。
- 已完成（领过币）的挑战不可再激活。

### 2. 挑战树（8 个，三层；币供给合计 22）

| 层 | id | 名称 | 条件修饰 | 目标 | 币 | 前置 |
|---|---|---|---|---|---|---|
| 1 | no-salary | 无薪挑战 | 无工作收入（在线+离线均不发薪，周期照走） | 某鱼卖出净额 ¥2000（xyEarn） | 2 | — |
| 1 | marathon | 肝帝 | 疲劳增长 ×1.5 | 游玩 100 局（plays） | 2 | — |
| 2 | flea-market | 捡漏之王 | 某鱼刷新间隔 ×0.5、到货件数 ×2 | 捡漏 5 次（bargainBuys，成交价 ≤ 总价值 90%） | 2 | no-salary |
| 2 | merchant | 壮壮 | 某鱼到货件数 ×0.5 | 200% 定价高价成交 10 次（highPriceSold） | 3 | no-salary |
| 2 | hardcore | 硬核玩家 | 六维经验 ×0.6 | 精通 3 款（masteryCount） | 3 | marathon |
| 3 | big-earner | 叉叉 | 收藏架最多 5 款不同桌游实体（maxDistinctCopies）；某鱼成交率 ×1.2 | 图鉴收藏 20 款（distinctCollections） | 4 | flea-market, merchant |
| 3 | collector | 花佬 | 不可游玩桌游（在线开局 + 离线自动游玩全禁）；激活时资金 +¥1000 | 架上 30 款不同桌游实体（distinctCopies） | 4 | hardcore |
| 3 | whale | 柠檬佬 | 某赏价格 ×1.5（常驻池 + 桌游池） | 抽赏 100 次（pulls） | 2 | hardcore |

**叉叉玩法循环**：买新款 → 开图鉴 → 卖掉腾位 → 再买下一款。图鉴是账号级进度
（`CollectionEntry`），实体卖光后 `firstOpened` 保留，`distinctCollections` 计数不回落；
已有款的加购副本不受 `maxDistinctCopies` 限制，出售不受任何限制。

### 3. GoalType 定义

| type | 含义 | 数据来源 |
|---|---|---|
| xyEarn | 某鱼卖出净额累计（成交价 − 手续费） | `stats.xyEarned`（新增统计，成交通道累计） |
| bargainBuys | 捡漏次数（购买价 ≤ 总价值 × 0.9） | `stats.bargainBuys` |
| masteryCount | 已精通桌游款数 | GAMES 清单 × `isMastered` |
| plays | 游玩局数（在线 + 离线） | `stats.plays` |
| highPriceSold | 200% 定价成交次数 | `stats.highPriceSold` |
| pulls | 抽赏次数（含精通池） | `stats.pulls` |
| distinctCopies | 收藏架上存在实体的不同桌游款数（copies 去重 gameId） | `state.copies` |
| distinctCollections | 已开图鉴的收藏款数（卖光也算） | `state.collections`（firstOpened 计数） |

### 4. 挑战币商店 CHALLENGE_SHOP

价格公式：`cost = base + step × 当前等级`；全部 base=1、step=0（**每级 1 币**）。
`after` 前置：需先将前置物品点到 ≥1 级。**合计 20 币，供给 22 币 → 全收集余 2 币**，
但受前置链约束必须按顺序投资。后续新增挑战 = 纯余量；新增商店内容须同步加挑战。

| 线 | id | 名称 | 效果 | max | 小计 | 前置 |
|---|---|---|---|---|---|---|
| 收藏 | exp-boost | 博览群玩 | 全局经验 +5%/级（与既有乘区并列相乘） | 5 | 5 | — |
| 收藏 | xy-eye | 火眼金睛 | 某鱼好货概率 +8%/级：带牌套概率 25% → 25%+8%/级（封顶 100%），成色下限 30% → +15%/级 | 3 | 3 | exp-boost ≥1 |
| 设计 | insp-up | 灵感如泉 | 灵感获取 +15%/级 | 5 | 5 | — |
| 设计 | score-up | 匠心独运 | 设计评分 +8%/级 | 4 | 4 | insp-up ≥1 |
| 设计 | royalty-up | 畅销作家 | 版税率 +12%/级 | 3 | 3 | score-up ≥1 |

> 设计线三件（灵感/评分/版税）为**桌游设计师玩法（Phase 2）**的加成，
> Phase 1 只定义数据与购买/等级读取，**不做任何消费**。收藏线两件即时生效。

### 5. 存档变更登记（v12 → v13）

- `GameState.challenge: { active: string | null; progress: number }`（周目级，转生重置）。
- `PrestigeState.coins: number`（挑战币，跨周目保留）。
- `PrestigeState.shop: Record<string, number>`（挑战商店等级，跨周目保留）。
- `PrestigeState.challengeDone: string[]`（已领币挑战 id，跨周目保留；转生白名单同步加入）。
- `stats.xyEarned: number`（某鱼卖出净额累计，生涯统计跨周目保留）。
- 迁移 v12→v13 为恒等迁移；`normalize` 补默认值并剔除未知挑战 id / 未知商店 id。

## 二、桌游设计师（Phase 2，**未实现**）

以下为公式初稿（以 Phase 2 实现时的设计文档为准），本期仅登记，代码不落地。

- 解锁：担任「桌游设计师」职业（master）后周目内解锁。
- 灵感：从游玩收藏中获得，按所玩桌游稀有度 N+1 / R+2 / SR+4 / SSR+8（隐藏款 ×2），乘 `insp-up`。
- 设计原型：消耗灵感 + 六维属性经验（**直接扣经验 = 真实降等级**，与保职业需求形成张力）→ 生成原型。
- 评分（初稿）：`score = clamp(1, 100, 基础30 + Σ(投入属性等级 × 6 × 主题权重) + 灵感/5 + 收藏精通款数 × 2)`，乘 `score-up`。
- 出版（初稿）：印刷费 `cost = 500 + score² × 2`；产出 10 份自有实体（独立 id 空间，不进 GAMES 表），可挂某鱼出售。
- 版税（初稿）：每 tick 概率 `score/20000`，触发得 `price × 0.1 × royalty-up`，按出版时长 `1/(1+天数)` 衰减。
- 产出不计入图鉴/转生权重（按 `designed` 标记排除）。

## 三、明确不做（本期）

- 桌游吧玩法（第三阶段）。
- 在线排行榜挑战成绩上报。
- 挑战计时类目标（先靠 stats 计数器覆盖）。
