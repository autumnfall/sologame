<script setup lang="ts">
import { ATTR_EFFECT, ATTR_ICON, ATTRS, ROMAN, attrProgress, fmt, globalBonus } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const TABS = [
  { key: 'play', label: '🎲 游玩' },
  { key: 'work', label: '💼 工作' },
  { key: 'shop', label: '🛒 商店' },
  { key: 'shelf', label: '📚 收藏架' },
  { key: 'guide', label: '📖 教程' },
] as const;

function chipTitle(a: (typeof ATTRS)[number]): string {
  const p = attrProgress(store.s, a);
  return `经验 ${p.cur} / ${p.need}（游玩对应机制的桌游获得经验；首次入手新桌游有一次性开箱经验）\n效果：${ATTR_EFFECT[a]}`;
}
</script>

<template>
  <div id="topbar">
    <div id="statusbar">
      <span>💰 <span class="res">{{ fmt(store.s.money) }}</span> 元</span>
      <span>🎴 牌套 <b>{{ store.s.sleeves }}</b> 张</span>
      <span>🎫 抽赏券 <b>{{ store.s.tickets }}</b></span>
      <span v-if="store.s.hiTickets > 0">🎟️ 高级券 <b>{{ store.s.hiTickets }}</b></span>
      <span class="attrs">
        <span v-for="a in ATTRS" :key="a" class="attr-chip" :title="chipTitle(a)">
          {{ ATTR_ICON[a] }}{{ a }} <b>{{ ROMAN[attrProgress(store.s, a).lv] }}</b>
          <span class="prog">{{ attrProgress(store.s, a).cur }}/{{ attrProgress(store.s, a).need }}</span>
        </span>
      </span>
      <span class="gbonus">图鉴加成 +{{ (globalBonus(store.s) * 100).toFixed(1) }}%</span>
    </div>

    <div id="tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        :class="{ active: store.tab === t.key }"
        @click="store.tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>
  </div>
</template>
