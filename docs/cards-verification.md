# 牌套数据核实报告（cards 字段）

> 核实日期：2026-09-11
> 口径：基础版游戏中需要套标准牌套保护的卡牌总张数（不含扩展/promo；LCG 只算基础盒；纸笔/纯骰子/纯 token 类为 null）

## 总结

- 共 37 款游戏，**30 款需要修改**，其中 4 款 `null → 有卡`（卡斯卡迪亚、时空神探、欢迎来到月球、自然和弦、哈德良长城实为 5 款），1 款 `有卡 → null`（阿勒农场）
- 偏差最大的是：**骰谜奇境 200→602**、**血源诅咒 200→509**、**奋进号：深海 150→36**、**绝命少女 200→23**
- 置信度 medium（单一来源，建议人工复核）共 12 款，已在表中用 ★ 标出
- 数据来源优先级：官方 rulebook 组件表 > 出版商产品页/BGG 描述 > 社区牌套数据库；冲突时以 rulebook 为准

## 待拍板事项

1. **诡镇奇谈LCG**：重制版核心盒 366 张 vs 旧版 239 张——建议按现售重制版取 **366**
2. **灵迹岛**：纯游戏卡 122 vs 含玩家辅助卡/进度卡 134——建议取 **134**（反正都要套）
3. **阿纳克遗迹**：110 张标准卡之外有 4 张 115×160 大卡——建议计入取 **114**
4. ★ 标记的 12 款只有单一来源，建议抽查后再定稿

## 明细

### N 级

| id | 游戏 | 现值 | 核实值 | 置信度 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| guoyuan | 果园 | 36 | 18 | high | https://www.meeplemountain.com/reviews/orchard-9-card-solitaire/ | 9 张牌组×2 套便于连续两局 |
| zongming | 绝顶聪明 | null | null | high | https://toppingthetable.com/how-to-play/how-to-play-thats-pretty-clever/ | 纯骰子+记分纸，确认无卡 |
| kafei | 咖啡烘焙师 | null | null | high | https://boardgamegeek.com/boardgame/196526/coffee-roaster | 豆单是版图非卡，确认无卡 |
| zhitu | 王国制图师 | 33 | 41 | high | https://rulespal.com/cartographers/rulebook | 探索13+计分16+伏击4+季节4+法令4；商店页"43 cards"疑含 2 张广告卡，以 rulebook 为准 |
| kaska | 卡斯卡迪亚之旅 | null | 21 ★ | high | https://www.alderac.com/wp-content/uploads/2021/08/Cascadia-Rules.pdf | AEG 官方规则书：5 种野生动物计分卡各 4 + 家庭 1 |
| shikong | 时空神探 | null | 18 ★ | medium | https://meepleandthemoose.com/2026/04/18/kronologic-paris-1920-board-game-review/ | 6 人物+6 时间+6 房间打孔卡；未见官方组件表全文 |
| boendi | 勃艮第城堡 | null | null | high | https://misutmeeple.com/en/2014/03/review-the-castles-of-burgundy/ | 六角板块+骰子，确认无卡 |
| xueyuan | 血源诅咒 | 200 | 509 ★ | medium | https://www.miniaturemarket.com/cmnbbe001.html | CMON 零售版内容表：枪械11+属性108+消耗品奖励61+敌人Boss75+剧情250+辅助4 |
| xuankong | 虚空降临 | 300 | 362 ★ | medium | https://www.sleeveyourgames.com/sleeves/9895/voidfall | 牌套库 252(44×67)+110(70×110)，与官方"350+ Cards"吻合 |
| jilu | 姬路城 | 90 | 77 | high | https://devir.world/thewhitecastle/components_ENG.html | Devir 官方组件页：城堡36+庭园10+起始行动6+起始资源9+法令3+单人9+辅助4 |
| anake | 阿纳克遗迹 | 150 | 110 | high | https://boardgamegeek.com/boardgame/312484/lost-ruins-of-arnak/sleeves | 标准卡 110；另有 4 张 115×160 大卡（待拍板是否计入） |
| xingkong | 星空觅迹 | 200 | 216 | high | https://www.czechgames.com/games/seti-search-for-extraterrestrial-intelligence | CGE 官方页标注 Cards (216) |
| hezou | 黑色奏鸣曲 | 30 | 55 | high | https://tesera.ru/images/items/1265882/Black_Sonata_rules.pdf | 官方规则书：潜行32+黑女士11+雾10+倒计时1+速览1 |

### R 级

| id | 游戏 | 现值 | 核实值 | 置信度 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| yueliang | 欢迎来到月球 | null | 220 ★ | medium | https://www.sleeveyourgames.com/sleeves/8404/welcome-to-the-moon | 社区牌套库统计；官方法文 rulebook 配件页为图片版无法文字核对 |
| manwei | 漫威LCG | 350 | 373 | high | https://boardgamegeek.com/boardgame/285774/marvel-champions-the-card-game | 343 标准卡(63.5×88)+30 状态卡(41×63) |
| toumi | 骰谜奇境 | 200 | 602 | high | https://thunderworksgames.com/products/roll-player-adventures-board-game | 官方清单 14 种卡合计（Discovery103+Title107+…+Weapon26） |
| zonglvdao | 棕榈岛 | 48 | 63 | high | https://boardgamegeek.com/boardgame/239464/palm-island | 2×17 玩家牌组+9 Feat+5 合作+14 竞争+1 回合标记 |
| fende | 奋进号：深海 | 150 | 36 ★ | high | https://gamefound.com/en/projects/age-of-gaming/endeavor-deep-sea/products/details/36617 | 零售版 30 Journal+6 合作卡；Deluxe/KS 版多 2 张 |
| guyong | 孤勇英豪 | 120 | 277 | high | https://renegadegamestudios.com/unstoppable/ | Renegade 官方：Portrait4+Character12+Starting Core14+Starting Threat26+Core100+Threat39+Upgrade36+Boss46 |
| mori | 末日决战 | 400 | 318 ★ | medium | https://www.sleeveyourgames.com/sleeves/19/aeons-end | 牌套库 318，与 GameRules 配件清单合计一致（2E rulebook 为图片版） |
| dasoucha | 大搜查系列 | 60 | 190 ★ | medium | https://www.sleeveyourgames.com/sleeves/2654/unlock-escape-adventures | 塔罗尺寸；教程 10+3 剧本各 60；卡牌可复用非销毁 |
| diguo | 帝国：经典 | 280 | 281 | high | https://bghub.org/r/imperium-classics.pdf | 官方 rulebook：8 文明牌组 193+公共 83+国家 4+至日 1 |

### SR 级

| id | 游戏 | 现值 | 核实值 | 置信度 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| tigemei | 提戈梅公会 | 50 | 101 | high | https://cdn.1j1ju.com/medias/9e/c0/7e-the-guild-of-merchant-explorers-rulebook.pdf | 官方 rulebook：目标24+探索9+调查28+宝藏40 |
| haigu | 骸骨险境 | 100 | 122 | high | https://boardgamegeek.com/boardgame/192135/too-many-bones | BGG 配件清单：遭遇60+战利品60+封面/天数2 |
| jueming | 绝命少女 | 200 | 23 | high | https://www.sleeveyourgames.com/sleeves/7163/final-girl-core-box?basegame=true | 仅核心盒 23 张行动卡；200 疑似误算了扩展 |
| ziran | 自然和弦 | null | 46 ★ | medium | https://www.rykergames.com/products/harmonies-card-sleeve-kit | 动物卡 46 张(70×120)，无其他卡牌 |
| luoma | 罗马：帝国的命运 | 100 | 174 | high | https://bestwith1.com/wp-content/uploads/2024/09/Rulebook.pdf | 官方 rulebook：属性60+领土25+发展59+纷争贷款20+法令10 |
| hadeliang | 哈德良长城 | null | 120 ★ | medium | https://www.sleeveyourgames.com/sleeves/7634/hadrians-wall | 牌套库记录 120 张(54×86) |
| moling | 魔戒LCG | 350 | 226 | high | https://www.fantasyflightgames.com/ffg_content/lotr-lcg/LOTR%20Rules.pdf | FFG 官方：12 英雄+120 玩家牌+94 遭遇牌 |
| aleb | 阿勒农场 | 180 | null | high | https://www.ultraboardgames.com/fields-of-arle/game-rules.php | 官方 rulebook 无任何卡牌，建筑/旅行目的地均为板块 |
| beijing | 为了北境森林 | 80 | 65 ★ | medium | https://talkingshelfspace.com/review-for-northwood/ | 开箱：对话32+角色24+领地8+箭头标记1 |
| ershiqiang | 20强 | 30 | 68 ★ | medium | https://chiptheorygames.com/products/20-strong-too-many-bones-deck | CTG 官方：5 Gearloc+4 暴君+43 敌人+16 遭遇 |

### SSR 级

| id | 游戏 | 现值 | 核实值 | 置信度 | 来源 | 备注 |
|---|---|---|---|---|---|---|
| lingji | 灵迹岛 | 200 | 122 ★ | medium | https://spiritislandwiki.com/index.php?title=Base_Game | 纯游戏卡 122；含 8 辅助+4 进度卡则 134（待拍板） |
| aoding | 奥丁的盛宴 | 180 | 237 | high | https://gamerules.com/rules/a-feast-for-odin/ | 职业卡 190+武器卡 47（Mayday 牌套指南亦记 237） |
| fangzhou | 方舟动物园 | 250 | 255 | high | https://boardgamegeek.com/boardgame/342942/ark-nova | 动物128+赞助商64+保护项目20+终局11+基础保护12+行动20 |
| guizhen | 诡镇奇谈LCG | 300 | 366 ★ | medium | https://boardgamegeek.com/wiki/page/thing:205637:moreinfo | 重制版核心盒 366；旧版核心盒 239（待拍板按哪个版本） |
| mofa | 魔法骑士UE | 400 | 377 | high | https://boardgamegeek.com/boardgame/248562/mage-knight-ultimate-edition | 终极版整盒 377（含原版基础+全扩展；原版基础 240） |

## 影响面（改数据前需联动检查）

- `cards` 影响：套牌套消耗张数（`engine/actions.ts`）、二手价值（`copyValue` 每 50 张 +10 元，`data/balance.ts`）、某鱼货源是否带牌套（`engine/xianyu.ts`）
- 写死数值的测试：`tests/data.test.ts:44-49`、`tests/mechanics.test.ts:252-261`
- 经济平衡：牌套产出主要来自抽赏（30/15/5 包），数值普遍上调后需评估牌套产消
- 存档兼容：已套牌套的实体只存 `sleeved: true`，无张数快照，无需迁移
