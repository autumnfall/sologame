<script setup lang="ts">
import { computed } from 'vue';
import {
  GAMES,
  canStore,
  gainText,
  gameById,
  globalBonus,
  kindCount,
  masteryText,
  storageCost,
} from '../../core';
import { useGameStore } from '../stores/game';
import FilterBar from '../components/FilterBar.vue';
import GameCard from '../components/GameCard.vue';

const store = useGameStore();

const shelfCount = computed(
  () => `${kindCount(store.s)} 种 / ${GAMES.length} · 全局加成 +${(globalBonus(store.s) * 100).toFixed(1)}%`,
);

const ownedIds = computed(() =>
  Object.keys(store.s.owned).filter(
    id => store.s.owned[id].count > 0 && (!store.shelfFilter || gameById(id).attrs.includes(store.shelfFilter)),
  ),
);
</script>

<template>
  <div>
    <h2>收藏架 <small>{{ shelfCount }}</small></h2>
    <FilterBar v-model="store.shelfFilter" />
    <div v-if="!ownedIds.length" class="mut">收藏架空空的。</div>
    <div v-else class="grid">
      <GameCard v-for="id in ownedIds" :key="id" :game="gameById(id)">
        <div>{{ masteryText(store.s, gameById(id)) }} · 疲劳 {{ store.s.owned[id].fatigue }} · ×{{ store.s.owned[id].count }}</div>
        <div class="tagline">每局 {{ gainText(gameById(id)) }}</div>
        <div class="tagline">
          {{ gameById(id).cards
            ? (store.s.owned[id].sleeved ? '🎴已套牌套(×0.85)' : `🎴未套（需 ${gameById(id).cards} 张）`)
            : '🎴无卡牌·无需牌套' }}
          {{ canStore(gameById(id))
            ? (store.s.owned[id].stored ? '📦已收纳(Setup×0.5)' : `📦未收纳（¥${storageCost(gameById(id))}）`)
            : '📦小盒·无需收纳' }}
        </div>
        <div v-if="gameById(id).affix" class="tagline" style="color:#d9a5f5">✦ {{ gameById(id).affix?.desc }}</div>
        <div class="bar" title="疲劳">
          <i
            :style="{
              width: Math.min(100, store.s.owned[id].fatigue * 10) + '%',
              background: store.s.owned[id].fatigue >= 7 ? 'var(--red)' : 'var(--green)',
            }"
          ></i>
        </div>
        <template #actions>
          <div style="margin-top:6px;display:flex;gap:5px;flex-wrap:wrap">
            <button
              v-if="gameById(id).cards && gameById(id).cards! > 0 && !store.s.owned[id].sleeved"
              :disabled="store.s.sleeves < (gameById(id).cards ?? 0)"
              @click="store.sleeve(id)"
            >
              套牌套 {{ gameById(id).cards }}张
            </button>
            <button
              v-if="canStore(gameById(id)) && !store.s.owned[id].stored"
              :disabled="store.s.money < storageCost(gameById(id))"
              @click="store.storage(id)"
            >
              收纳 ¥{{ storageCost(gameById(id)) }}
            </button>
          </div>
        </template>
      </GameCard>
    </div>
  </div>
</template>
