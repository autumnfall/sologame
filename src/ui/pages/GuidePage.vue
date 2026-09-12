<script setup lang="ts">
import { ref } from 'vue';
import { ATTR_ICON, ATTRS } from '../../core';
import type { Attr } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const MECH: Record<Attr, string> = {
  谋略: '策略 / 长线规划',
  演算: '拼图 / 计算',
  应变: '骰子 / 运气管理',
  运筹: 'DBG / 资源调度',
  洞察: '推理 / 解谜',
  沉浸: '叙事 / 冒险代入',
};

/** 教程用文字版效果说明（不给具体数值） */
const GUIDE_EFFECT: Record<Attr, string> = {
  谋略: '游玩获得的经验更多，升级全局加速',
  演算: '玩桌游更省时（有上限）',
  应变: '工作酬劳更高；主播带货的收入下限更高',
  运筹: '某鱼买货更便宜；卖出手续费更低，堆满可全免',
  洞察: '抽赏券掉得更多；时机条金色区更宽、更容易命中',
  沉浸: '疲劳增长更慢，单一游戏能玩得更久（有上限）',
};

// ---------- 存档管理 ----------
const importInput = ref<HTMLInputElement | null>(null);

function onImportPicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) store.importSaveFile(file);
  input.value = ''; // 允许重复选同一文件
}
</script>

<template>
  <div>
    <h2>📖 新手指引</h2>
    <div class="panel" style="margin-bottom:12px">
      <h3>🎯 核心循环</h3>
      <p class="mut">玩桌游获得属性经验 → 属性达标解锁更高级的工作 → 工作赚钱 →
      通过四个渠道收集新桌游 → 图鉴与属性加成一起变强 → 解锁更高级的工作……
      最终目标：六维全部修满，成为「桌游设计师」。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>⏱️ 时间模型</h3>
      <p class="mut">游戏内时间随现实流逝：放着不动，工作会自动累积酬劳、手头有桌游还会自动连刷（都有上限）；回来时自动结算并弹出离线总结，无需手动领取。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🧭 六维属性</h3>
      <table style="width:100%;font-size:13px;line-height:2">
        <tr class="mut"><td>属性</td><td>对应机制</td><td>效果</td></tr>
        <tr v-for="a in ATTRS" :key="a">
          <td>{{ ATTR_ICON[a] }} {{ a }}</td>
          <td class="mut">{{ MECH[a] }}</td>
          <td>{{ GUIDE_EFFECT[a] }}</td>
        </tr>
      </table>
      <p class="mut" style="margin-top:6px">经验来源：游玩对应机制的桌游（多属性桌游按比例分摊），以及首次入手新桌游时的一次性开箱奖励。升级所需经验逐级递增，属性同时也是高级工作的门槛。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🎲 游玩流程</h3>
      <p class="mut">每局分「读规则 → Setup → 游玩 → 结算」几段（读过规则后自动跳过第一段）。每段会出现时机条，点击（或按空格）命中金色区可以直接省掉这一大段——眼疾手快收益高。同一游戏默认自动连刷；一盒有多个实体时，开玩前可以选具体玩哪一盒。</p>
      <p class="mut" style="margin-top:4px">想玩得快：提升熟练度和演算、给实体套牌套（还减半磨损）、给大盒做收纳（省 Setup、之后磨损也更慢）。同一款玩够局数会「精通」，时长再减半。疲劳会压低收益，封面变灰「玩腻了」时就该换一款。</p>
      <p class="mut" style="margin-top:4px"><b>收藏 / 实体分离</b>：熟练度、精通、疲劳、读规则记在「收藏」上（账号进度，实体卖光也保留）；成色、牌套、收纳、耐久记在「实体」上。每次游玩实体都会磨损，磨光后仍可游玩但收益减半；成色影响某鱼的买卖价格，磨旧的实体可以二手出掉、或干脆买盒新的。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🛒 四个获得渠道</h3>
      <p class="mut">① <b>开局三选一</b>：决定前期的属性方向；② <b>某宝</b>：按稀有度逐级解锁，集齐当前级别才能买下一级，每款限量、售完不补；③ <b>某鱼</b>：二手货源，都是带成色的实体、价格有赚有亏，<b>唯一能跨级别淘到高级桌游的渠道</b>，还有机会刷出「隐藏款」（各带独特词条，商店与某赏均不出）；每批另附 <b>1 件一口价盲买</b>——只看得到名字，成色全凭运气；④ <b>某赏</b>：扭蛋机，主要出牌套、也有机会直接抽出桌游（越稀有越难出，有保底），不受级别解锁限制；抽出重复款会得到一个新实体，可以挂某鱼出售。收藏的种类越多，全局经验加成越高。</p>
      <p class="mut" style="margin-top:4px"><b>🐟 某鱼买卖</b>：自己用过的实体也能上架（占用出售槽位，可花钱扩充），成色越新越好卖、定价越接近行情越快成交；平台收取手续费，运筹属性可以减免。市场上架数量也可以花钱扩充。</p>
      <p class="mut" style="margin-top:4px"><b>🌀 某赏桌游池</b>：仅出桌游（不出牌套），每 10 分钟轮换一个主题属性，只能用金钱或「高级券」抽取（保底独立计数，50 抽必出 SR 及以上）。<b>高级券</b>用普通券加牌套兑换，可批量。</p>
      <p class="mut" style="margin-top:4px"><b>🎯 某赏精通池</b>：花 200 张牌套抽一次，范围是你已入手且尚未精通的桌游（概率 N60 / R30 / SR8 / SSR2），抽到不获得新实体，而是直接加对应收藏的熟练值（N+5 / R+10 / SR+20 / SSR+40）；若抽中的稀有度你已全部精通，则该次改为 +100 牌套。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🏆 成就</h3>
      <p class="mut">达成成就各提供 <b>+1% 全局经验</b>（无上限），并计入里程碑：每达成 5 个成就解锁一项<b>功能性优化</b>——连刷自动更换（疲劳/精通两档互斥）、某赏十连抽、一键套牌套、一键上架磨光件等，在转生页查看进度与全部成就列表。</p>
    </div>
    <div class="panel" style="margin-bottom:12px">
      <h3>🌅 退坑转生</h3>
      <p class="mut">当精通足够多的桌游后，可以选择「退坑出清」：本周目的收藏、实体、金钱、属性、职业都会重置，但会换来「桌游阅历」——精通越多、图鉴越全，阅历越多。阅历可以在转生页投资<b>永久天赋</b>（收藏、效率、商业三条线），之后的每个新周目都带着天赋重新三选一开局，越玩越强；生涯统计始终保留。天赋随时可以洗点重分，放心试错——但<b>只能在转生后、开启新周目前调整（含洗点）</b>，本周目内锁定。转生后会先弹出<b>强制投资界面</b>：可立刻用新到账的阅历购买天赋，只能点「开启新周目」继续——「启动资金」「老主顾」在选定开局桌游时结算，「老友馈赠」需在弹窗里提前持有。</p>
    </div>
    <div class="panel" style="margin-top:12px">
      <h3 style="margin:0 0 6px">💾 存档管理</h3>
      <div class="mut" style="margin-bottom:8px">存档自动保存在浏览器本地。可导出 JSON 备份、导入旧存档（自动迁移到当前版本），或清空重开。</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button @click="store.exportSave()">📤 导出存档</button>
        <label style="display:inline-flex;align-items:center;gap:6px">
          <input
            ref="importInput"
            type="file"
            accept=".json,application/json"
            style="display:none"
            @change="onImportPicked"
          />
          <button @click="(importInput as HTMLInputElement)?.click()">📥 导入存档</button>
        </label>
        <button class="danger" @click="store.resetGame()">🗑️ 重新开始</button>
      </div>
    </div>
  </div>
</template>
