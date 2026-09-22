<script setup lang="ts">
import { computed } from 'vue';
import { ATTR_EFFECT, ATTR_ICON, ATTRS, attrProgress, fmt, globalBonus } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const TABS = [
  { key: 'play', label: '🎲 游玩' },
  { key: 'work', label: '💼 工作' },
  { key: 'shop', label: '🛒 商店' },
  { key: 'shelf', label: '📚 收藏架' },
  { key: 'challenge', label: '🎯 挑战' },
  { key: 'design', label: '🎨 设计' },
  { key: 'prestige', label: '🌅 转生' },
  { key: 'guide', label: '📖 教程' },
  { key: 'changelog', label: '📝 更新' },
] as const;

/** 属性徽章：等级 0 时只显示图标与名称（无等级数字、无 0/60 进度），有经验后再展开 */
const attrChips = computed(() =>
  ATTRS.map(a => {
    const p = attrProgress(store.s, a);
    return {
      a,
      lv: p.lv,
      prog: p.lv > 0 ? `${p.cur}/${p.need}` : '',
      title: `经验 ${p.cur} / ${p.need}（游玩对应机制的桌游获得经验；首次入手新桌游有一次性开箱经验）\n效果：${ATTR_EFFECT[a]}`,
    };
  }),
);
</script>

<template>
  <div id="topbar">
    <div id="statusbar">
      <span>💰 <span class="res">{{ fmt(store.s.money) }}</span> 元</span>
      <span>🎴 牌套 <b>{{ store.s.sleeves }}</b> 张</span>
      <span>🎫 抽赏券 <b>{{ store.s.tickets }}</b></span>
      <span v-if="store.s.hiTickets > 0">🎟️ 高级券 <b>{{ store.s.hiTickets }}</b></span>
      <span v-if="store.s.prestige.runs > 0" :title="`已完成 ${store.s.prestige.runs} 周目；退坑转生获得阅历，可投资永久天赋`">🌅 阅历 <b>{{ store.s.prestige.insight }}</b> · 第 {{ store.s.prestige.runs + 1 }} 周目</span>
      <span class="attrs">
        <span v-for="c in attrChips" :key="c.a" class="attr-chip" :class="{ virgin: c.lv === 0 }" :title="c.title">
          {{ ATTR_ICON[c.a] }}{{ c.a }}<template v-if="c.lv > 0">&nbsp;<b>Lv{{ c.lv }}</b>
          <span class="prog">{{ c.prog }}</span></template>
        </span>
      </span>
      <span class="gbonus">图鉴加成 +{{ (globalBonus(store.s) * 100).toFixed(1) }}%</span>
    </div>

    <div id="tabs">
      <button
        v-for="t in TABS"
        v-show="t.key !== 'design' || store.s.designer.unlocked"
        :key="t.key"
        :class="{ active: store.tab === t.key }"
        @click="store.tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>
  </div>
</template>
