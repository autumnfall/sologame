<script setup lang="ts">
import { ATTR_EFFECT, ATTR_ICON, ATTRS, JOBS, ROMAN } from '../../core';
import type { Attr } from '../../core';

const MECH: Record<Attr, string> = {
  谋略: '策略 / 长线规划',
  演算: '拼图 / 计算',
  应变: '骰子 / 运气管理',
  运筹: 'DBG / 资源调度',
  洞察: '推理 / 解谜',
  沉浸: '叙事 / 冒险代入',
};

function jobReq(req: Partial<Record<Attr, number>>): string {
  const entries = Object.entries(req);
  if (!entries.length) return '无门槛';
  return entries.map(([a, lv]) => `${ATTR_ICON[a as Attr]}${a} ${ROMAN[lv as number]}`).join(' + ');
}
</script>

<template>
  <div>
    <h2>📖 新手指引</h2>
    <div class="panel" style="margin-bottom:12px">
      <h3>🎯 核心循环</h3>
      <p class="mut">玩桌游（手动点时机条，获得属性经验）→ 属性达标解锁更高级工作 → 工作赚钱 →
      通过四个渠道获得新桌游 → 图鉴与属性加成提升 → 更高级工作……目标：成为全属性 Ⅳ 的「桌游设计师」。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>⏱️ 时间模型</h3>
      <p class="mut">游戏内 1 分钟 = 现实 1 秒。单次游玩的游戏内时长封顶 60 分钟；短局桌游（≤15 分钟）适合手动连刷，长局桌游经验更高、适合挂机。离线收益累积上限 1 小时，回来自动存入待领取。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🧭 六维属性（全部效果均为相乘）</h3>
      <table style="width:100%;font-size:13px;line-height:2">
        <tr class="mut"><td>属性</td><td>对应机制</td><td>实际效果</td></tr>
        <tr v-for="a in ATTRS" :key="a">
          <td>{{ ATTR_ICON[a] }} {{ a }}</td>
          <td class="mut">{{ MECH[a] }}</td>
          <td>{{ ATTR_EFFECT[a] }}</td>
        </tr>
      </table>
      <p class="mut" style="margin-top:6px">经验来源：① 游玩对应机制的桌游（多属性按比例分摊：双属性 65/35，三属性 50/30/20，四属性 40/30/20/10）；② 首次入手新桌游的一次性开箱经验（N 15 / R 30 / SR 60 / SSR 120）。升级所需经验逐级递增（60、170、312……）。属性同时是高级工作的门槛。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🎲 游玩流程</h3>
      <p class="mut">每局分「读规则 → Setup → 游玩 → 结算」四段（读过规则后自动跳过第一段）。每段出现时机条，点击（或空格）命中金色区则<b>该段进度立即 +50%（封顶 80%）</b>——眼疾手快直接省时间。同一游戏默认自动连刷，可在列表中「下轮换它」；一盒有多个实体时，开玩前可选具体玩哪一盒。</p>
      <p class="mut" style="margin-top:4px">减速乘区：<b>熟练度</b>（每局 +1，时长最多降至 ×0.65）、<b>牌套</b>（实体级，有卡牌的游戏才可套，按实际卡牌数消耗牌套张数——1 包 = 50 张，时长 ×0.85）、<b>收纳</b>（实体级，仅市场价 >¥200 或大盒游戏可做，费用 = 基础价 ×0.2，Setup ×0.5）、<b>演算属性</b>（每级 -2%）。<b>精通</b>：同一款游玩达 N20 / R40 / SR80 / SSR160 局后基础时长再减半（⭐）。<b>疲劳</b>：玩一盒该盒 +2、其余 -1，收益 = 1/(1+疲劳×0.15)——封面变灰挂「玩腻了」时就该换游戏了。</p>
      <p class="mut" style="margin-top:4px"><b>收藏 / 实体分离</b>：熟练度、精通、疲劳、读规则记在「收藏」上（账号进度，实体卖光也保留）；成色、牌套、收纳、耐久记在「实体」上。<b>耐久</b>：每次游玩磨损 1（牌套减半 ×0.5）；收纳是一次性整理——做收纳时按稀有度额外扣一次耐久（N1/R2/SR3/SSR4），之后该实体磨损 ×0.75；磨光后仍可游玩但收益 ×0.5；成色（全新 / N成新）影响某鱼买卖价格。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🛒 四个获得渠道</h3>
      <p class="mut">① <b>开局三选一</b>：决定前期 build 方向；② <b>某宝</b>：基础价、按稀有度逐级解锁（集齐当前级全部常规款才能买下一级），每款限量 <b>N4 / R3 / SR2 / SSR1</b> 件、售完不补，可重复购买同款；③ <b>某鱼</b>：每件货源都是一个带成色的实体（3~10成新，可能带牌套/收纳），价格为总价值 50%~200%（受运筹砍价加成），<b>唯一能跨级别刷出高级桌游的渠道</b>，还有小概率刷出「隐藏款」（魔法骑士：终极版 / 20强 / 帝国：经典 / 黑色奏鸣曲，各带独特词条，商店与某赏均不出）；每批另附 <b>1 件一口价盲买</b>——只看得到名字，成色/牌套/收纳全隐藏，价格为总价值 80%~120%，搏一搏单车变摩托；货源每 5 分钟自动刷新（也可花 ¥20 手动刷新），已精通的款不再出现、已收藏也可重复购买；④ <b>某赏</b>：单抽约为某宝均价的 1/3，<b>不受级别解锁限制</b>；奖池为<b>牌套 46%（4包）/ 15%（10包）/ 5%（20包）+ 桌游 N20 / R10 / SR3 / SSR1</b>，50 抽必出 SR 及以上（保底触发时 SR:SSR = 3:1），抽出 SR/SSR 保底归零；桌游结果均为全新实体，重复款<b>直接获得一个新实体</b>（收藏级进度保留，可挂某鱼出售）。每多一种桌游（去重，含隐藏款），全属性经验 +1.5%（软上限 +50%）。</p>
      <p class="mut" style="margin-top:4px"><b>🐟 某鱼买卖</b>：出售区可把实体上架（占用出售槽位，初始 1 个，可花钱扩至 5 个），定价为实体总价值的 50%~200%，上架实体不可游玩；每 5 分钟按「(1.5−定价倍率)×(0.5+0.5×成色比)」判定成交，卖出收取手续费（基础 5%，<b>运筹每级 -0.3%，10 级全免</b>）、实体交付买家；磨旧的实体可以挂上某鱼出掉，或干脆买盒新的。市场货架初始每次刷新 3 件，可花钱扩至 7 件。</p>
      <p class="mut" style="margin-top:4px"><b>🌀 某赏轮换池</b>：除常驻池外，每 10 分钟轮换一个主题属性（如 🧠 谋略主题），池内仅出该主题的桌游，只能用金钱或「高级券」抽取（保底与常驻池独立计数，各 50 抽）。<b>高级券</b>：1 张普通券 + 50 张牌套兑换 1 张，可批量兑换。</p>
    </div>
    <div class="panel">
      <h3>💼 职业阶梯</h3>
      <table style="width:100%;font-size:13px;line-height:2">
        <tr class="mut"><td>职业</td><td>门槛</td><td>收入</td></tr>
        <tr v-for="j in JOBS" :key="j.id">
          <td>{{ j.name }}</td>
          <td class="mut">{{ jobReq(j.req) }}</td>
          <td class="mut">{{ j.auto ? `每 ${j.cycleSec / 60} 分钟 ¥${j.cyclePay}` + (j.volatile ? '（波动）' : '') : '游玩结算给钱' }}</td>
        </tr>
      </table>
      <p class="mut" style="margin-top:4px">工作是<b>周期制</b>：进度条满一个周期自动发一次酬劳，与玩桌游并行；换工作会放弃当前周期进度。离线收益按整周期累积、50% 折算，上限 1 小时。打工与游玩均有概率掉落某赏抽赏券（洞察越高掉率越高）。主播带货每周期结算时掷 ±50% 波动，沉浸可提高下限。</p>
    </div>
  </div>
</template>
