<script setup lang="ts">
import { computed } from 'vue';
import type { Game } from '../../core';
import { useGameStore } from '../stores/game';

const props = defineProps<{ game: Game; ownBadge?: boolean }>();
const store = useGameStore();

const owned = computed(() => store.s.collections[props.game.id]);
const tired = computed(() => !!owned.value && owned.value.fatigue >= 7);

/** 商店扫货用：收藏过才有标签；区分「手里有货」与「收藏过但已出清」 */
const ownInfo = computed(() => {
  if (!props.ownBadge || !owned.value?.firstOpened) return '';
  const n = store.s.copies.filter(c => c.gameId === props.game.id).length;
  return n > 0 ? `✔ 已拥有${n > 1 ? ` ×${n}` : ''}` : '↺ 无现货';
});

</script>

<template>
  <div class="card" :class="[`rar-${game.rarity}`, { tired }]">
    <span class="rarity">{{ game.rarity }}</span>
    <div class="badges">
      <span v-if="ownInfo" class="own-badge">{{ ownInfo }}</span>
      <span v-if="tired" class="fatigue-badge">玩腻了</span>
      <span v-if="game.hidden" class="fatigue-badge hidden-badge">隐藏款</span>
    </div>
    <div class="cover">
      <span class="cover-emblem" aria-hidden="true">{{ game.icon }}</span>
      <div class="cname">{{ game.name }}</div>
    </div>
    <div class="body">
      <slot />
    </div>
    <div v-if="$slots.actions" class="card-actions"><slot name="actions" /></div>
  </div>
</template>
