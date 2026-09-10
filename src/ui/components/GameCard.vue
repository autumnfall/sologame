<script setup lang="ts">
import { computed } from 'vue';
import type { Game } from '../../core';
import { useGameStore } from '../stores/game';

const props = defineProps<{ game: Game }>();
const store = useGameStore();

const owned = computed(() => store.s.owned[props.game.id]);
const tired = computed(() => !!owned.value && owned.value.fatigue >= 7);

// 封面渐变底色（对应原型 coverStyle）
const coverStyle = computed(() => {
  const c = { N: '#4a453c', R: '#233a5c', SR: '#3d2a5c', SSR: '#5c3a14' }[props.game.rarity];
  return { background: `linear-gradient(135deg,${c},#1a1712)` };
});
</script>

<template>
  <div class="card" :class="[`rar-${game.rarity}`, { tired }]">
    <span class="rarity">{{ game.rarity }}</span>
    <span v-if="tired" class="fatigue-badge">玩腻了</span>
    <span v-if="game.hidden" class="fatigue-badge" style="border-color:#b04ce8;color:#d9a5f5">隐藏款</span>
    <div class="cover" :style="coverStyle">
      {{ game.icon }}
      <div class="cname">{{ game.name }}</div>
    </div>
    <div class="body">
      <slot></slot>
      <slot name="actions"></slot>
    </div>
  </div>
</template>
