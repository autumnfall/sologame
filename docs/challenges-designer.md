# 挑战场景 + 桌游设计师 设计文档（数值定稿）

本文档是两个新系统（挑战场景 / 桌游设计师）的数值与结构定稿。后续代码以本文为准。
对应存档版本：**v12 → v13（挑战场景）→ v14（挑战激活改到转生流程）→ v15（桌游设计师）**。

## 一、挑战场景

### 1. 结构

- **选择时机**：只能在转生时选择。玩家确认天赋树后，在转生确认弹窗的「下周目挑战」区单选一个挑战（或「无挑战」），写入 `prestige.pendingChallenge`（跨周目字段）。
- **生效时机**：转生完成、新周目初始化时，pendingChallenge 转为 `challenge.active`（pending 清空），progress 归零；若该挑战带 `startMoneyBonus` 在**此刻**发放。
- **一周目仅一个挑战**：pending 单选 + active 单字段天然保证；正常游玩期**不可开启**（防止先攒资源再秒激活的刷取漏洞）。
- **陪跑到完成**：条件修饰持续整周目（在线 + 离线一致），达成目标 → 发挑战币 + 释放 active；**不可放弃**。完成后修饰即释放，玩家可正常游玩（如刷精通）至自行转生。
- 已完成（领过币）的挑战不可再选；奖励一次性，`challengeDone` 跨周目保留。

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
| 设计 | royalty-up | 畅销作家 | 众筹购买概率 +6%/级 | 3 | 3 | score-up ≥1 |

> 设计线三件（灵感/Q/众筹人气）由**桌游设计师玩法（见下）**消费；收藏线两件即时生效。

### 5. 存档变更登记（v12 → v13）

- `GameState.challenge: { active: string | null; progress: number }`（周目级，转生重置）。
- `PrestigeState.coins: number`（挑战币，跨周目保留）。
- `PrestigeState.shop: Record<string, number>`（挑战商店等级，跨周目保留）。
- `PrestigeState.challengeDone: string[]`（已领币挑战 id，跨周目保留；转生白名单同步加入）。
- `PrestigeState.pendingChallenge: string | null`（下次开周目生效的挑战，转生确认弹窗中选择，开新周目时被消费）。
- `stats.xyEarned: number`（某鱼卖出净额累计，生涯统计跨周目保留）。
- v13→v14 迁移为恒等迁移；`normalize` 补 `pendingChallenge`（null）默认值。
- 迁移 v12→v13 为恒等迁移；`normalize` 补默认值并剔除未知挑战 id / 未知商店 id。

## 二、桌游设计师（v5 定稿：曝光 · 预热 · 平台 · 事件 · 众筹）

- **解锁**：担任「桌游设计师」职业（master，全属性 4 级岗位）后周目内解锁（`designer.unlocked`）。
- **灵感**：游玩收藏获得，按稀有度 N+1 / R+2 / SR+4 / SSR+8（隐藏款 ×2），乘 insp-up（+15%/级），**cap 999**。在线与离线自动游玩都入账。
- **立项**（-10 灵感）：名称（2~10 字）+ 类型（8 主题）+ 体量（小盒/标准/大盒，成本基数 120/300/600、牌套需求 50/150/300）。
- **六维迭代**（灵感是唯一燃料，属性永不消耗）：机制深度=谋略 / 数值平衡=演算 / 重开变化=应变 / 组件美工=洞察 / 规则条理=运筹 / 主题沉浸=沉浸；每维 5 次、第 n 次 5n 灵感、增益 2+floor(0.4×属性等级)+主题主场 +1。
- **经营 exposure（v5）**：组织试玩 ¥50×2ⁿ（曝光 +8~15、看好种子 +0~3，沉浸/应变每级 +4% 产出）、社媒宣传 ¥30×1.6ⁿ（+5~10）、设计日记 3 灵感（+4）；试玩/宣传每日各 3 次（游戏日 = 24 秒）；曝光软上限 200，超出部分收益减半。
- **质量分**：`Q = clamp(1, 100, round((30 + Σ迭代×增益) × (1+0.08×scoreUp)))`；稀有度阈值 50/70/90（只影响需求概率）。
- **成本与定价**：成本价 = `round(体量基数 × (0.8+Q/100))`；发起时定价 100%~1000%。
- **预热与时间池（v5）**：发起时选平台——**某点**（抽成 5%、预热基础曝光 25/日）/ **某集**（抽成 3%、12/日），选定不可换；总期限 T∈[30,120] 天内分配预热 P∈[5, min(30,T−15)] + 众筹 T−P 天（1 天 = 24 秒现实）。预热逐日攒看好 = `round((曝光/10 + 平台基础曝光) × 定价亲和(100%→1.2、1000%→0.6 线性) × 质量系数(0.8+0.004Q))`；开众筹瞬间 看好 × 转化率（`15% + min(15%, Q/10×1%) − (定价倍率−1)×2%`，下限 5%）转初始支持。预热期可追加宣传（只加曝光，按剩余天数折算看好）。
- **众筹期事件（v5）**：每 5 天（120 秒）60% 触发，16 个事件池（同一项目轮空前不重复）；每个事件独立 5 天倒计时，超时或进入最后 5 天按默认选项兜底（不耗资源、结果中性或负面）；需求三类：属性等级 8~15 / 成交额 1%~6% / 灵感 3~8；结果两类：支持 ±3%~10%（不扣到 0 以下）、剩余天数流量 +25%~50% 乘区；全部记入 `eventHistory`（天数/选项/是否兜底/结果）。离线照常生成、倒计时照走，回来批量处理窗口内待决。
- **逐秒需求模拟**（在线每 tick、离线复用同一函数累计，cap 沿用离线 1h）：
  1. 基础关注 k = 随机 1~5 + floor(支持/100)，上限 10，× 事件流量乘区；
  2. 每人随机两个钟意题材，各与本作类型匹配 +10%；
  3. 售价 < ¥200：+10%；
  4. 溢价线性：+30% × (10−售价/成本价)/9；
  5. 稀有度：N/R/SR/SSR = +0/5/10/20%；
  6. 畅销作家（royaltyUp）：每级 +6%；
  7. rand < p 则支持 +1。
- **里程碑**：达目标 150%/200% 自动触发「解锁回报」+3%/+5% 支持并记入历史；提前满额不结束，继续累积。
- **到期结算**：支持 ≥ 目标 → **成功**：successCount+1、进 funded 待交付，**立即到账 round((货款−抽成)×50%)**；未达标 → **失败**：原型退回（iter 保留）、进 failed、无资金往来。
- **交付（两阶段 + 抽成）**：`deliverDesign(fundedUid)` 校验未交付且 `money ≥ cost` → `money −= cost; money += remainPayment`（净入账 = 支持×(售价×(1−抽成)−成本价)，可为负 = 亏损允许）→ `delivered = true`；funded 记录含 commission / firstPayment / remainPayment。
- **产出隔离**：`design-N` id 空间不进 GAMES 表；不计入图鉴/转生权重；不可游玩；存量 designed 副本套牌套按体量 sleeveCost 计费。
- **转生**：designer 状态周目级重置（不进转生白名单）。

### 6. 存档变更登记（v14 → v15）

- `GameState.designer: { unlocked, inspiration, prototypes, campaigns, funded, failed, nextUid, successCount }`（周目级，转生重置）。
- `Copy.designed?: true` + 自创实体 id 空间 `design-N`。
- normalize 兼容 v1 旧字段：旧 prototype（invested/insp、无 name/scale/iter）→ iter 全 0、体量 standard、名称回落「主题·uid号」；旧 published 数组 → 并入 funded（rarity 按 score 重算、支持者/收入记 0），successCount 兜底。

## 三、明确不做（本期）

- 桌游吧玩法（第三阶段）。
- 在线排行榜挑战成绩上报。
- 挑战计时类目标（先靠 stats 计数器覆盖）。
