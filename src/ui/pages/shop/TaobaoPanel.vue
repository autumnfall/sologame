<script setup lang="ts">
import { computed } from 'vue';
import { currentTier, gamesByRarity, nextTier, taobaoBase, tierOwned } from '../../../core';
import { useGameStore } from '../../stores/game';
import GameCard from '../../components/GameCard.vue';

const store = useGameStore();

// 仅显示当前可购买的最高级别货架；集齐后自动翻到下一级
const cur = computed(() => currentTier(store.s));
const total = computed(() => gamesByRarity(cur.value).length);
const ownedN = computed(() => tierOwned(store.s, cur.value));
const done = computed(() => ownedN.value >= total.value);
const nextTierKey = computed(() => nextTier(cur.value));

const headerText = computed(() => {
  const parts = [`收集进度 ${ownedN.value}/${total.value} · 每款限购 1 件`];
  if (done.value && nextTierKey.value) parts.push(` · 🎉 已集齐，即将解锁 ${nextTierKey.value} 级`);
  else if (nextTierKey.value) parts.push(` · 集齐后解锁 ${nextTierKey.value} 级`);
  else parts.push(' · 已是最高级别');
  return parts.join('');
});
</script>

<template>
  <div class="grid">
    <div style="grid-column:1/-1;margin-bottom:2px">
      <b :style="{ color: `var(--${cur})` }">{{ cur }} 级货架</b>
      <small class="mut">{{ headerText }}</small>
    </div>
    <GameCard v-for="g in gamesByRarity(cur)" :key="g.id" :game="g">
      <div class="tagline">{{ g.tags.join(' · ') }} · {{ g.playTime }}分钟</div>
      <template #actions>
        <div v-if="store.s.owned[g.id] && store.s.owned[g.id].count > 0" class="mut" style="margin-top:6px">✓ 已收藏</div>
        <div
          v-else-if="(store.s.taobaoStock[g.id] || 0) > 0"
          style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"
        >
          <span class="price">¥{{ taobaoBase(g) }}</span>
          <button
            class="primary"
            :disabled="store.s.money < taobaoBase(g)"
            @click="store.buyTb(g.id)"
          >
            购买
          </button>
        </div>
        <div v-else class="mut" style="margin-top:6px">已售罄</div>
      </template>
    </GameCard>
  </div>
</template>
