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
      <p class="mut">每局分「读规则 → Setup → 游玩 → 结算」四段（读过规则后自动跳过第一段）。每段出现时机条，点击（或空格）命中金色区则<b>该段进度立即 +50%（封顶 80%）</b>——眼疾手快直接省时间。同一游戏默认自动连刷，可在列表中「下轮换它」。</p>
      <p class="mut" style="margin-top:4px">减速乘区：<b>熟练度</b>（每局 +1，时长最多降至 ×0.65）、<b>牌套</b>（有卡牌的游戏才可套，按实际卡牌数消耗牌套张数——1 包 = 50 张，时长 ×0.85）、<b>收纳</b>（仅市场价 >¥200 或大盒游戏可做，费用 = 基础价 ×0.2，Setup ×0.5）、<b>演算属性</b>（每级 -2%）。<b>精通</b>：同一款游玩达 N20 / R40 / SR80 / SSR160 局后基础时长再减半（⭐）。<b>疲劳</b>：玩一盒该盒 +2、其余 -1，收益 = 1/(1+疲劳×0.15)——封面变灰挂「玩腻了」时就该换游戏了。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🛒 四个获得渠道</h3>
      <p class="mut">① <b>开局三选一</b>：决定前期 build 方向；② <b>某宝</b>：基础价、每款限购 1 件售完不补，且按稀有度逐级解锁——集齐当前级全部常规款才能买下一级；③ <b>某鱼</b>：市场价 50%~200% 浮动，<b>唯一能跨级别刷出高级桌游的渠道</b>，还有小概率刷出「隐藏款」（魔法骑士：终极版 / 20强 / 帝国：经典 / 黑色奏鸣曲，各带独特词条，商店与某赏均不出），货源每 5 分钟自动刷新（也可花 ¥20 手动刷新），价格受运筹砍价加成；④ <b>某赏</b>：单抽约为某宝均价的 1/3，概率 N62/R28/SR8/SSR2，<b>不受级别解锁限制</b>，50 抽硬保底 SSR，重复款转牌套（N×5 / R×10 / SR×20 / SSR×40 包）并叠加熟练度（N+4 / R+8 / SR+16 / SSR+32）。每多一种桌游（去重，含隐藏款），全属性经验 +1.5%（软上限 +50%）。</p>
    </div>
    <div class="panel">
      <h3>💼 职业阶梯</h3>
      <table style="width:100%;font-size:13px;line-height:2">
        <tr class="mut"><td>职业</td><td>门槛</td><td>收入</td></tr>
        <tr v-for="j in JOBS" :key="j.id">
          <td>{{ j.name }}</td>
          <td class="mut">{{ jobReq(j.req) }}</td>
          <td class="mut">{{ j.auto ? `¥${j.rate}/秒` + (j.volatile ? '（波动）' : '') : '游玩结算给钱' }}</td>
        </tr>
      </table>
      <p class="mut" style="margin-top:4px">高级工作自动进行并累积离线收益；打工与游玩均有概率掉落某赏抽赏券（洞察越高掉率越高）。主播带货收入波动大，沉浸可提高下限。</p>
    </div>
  </div>
</template>
