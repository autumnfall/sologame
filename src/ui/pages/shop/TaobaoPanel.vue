<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ATTR_ICON,
  ATTRS,
  TAOBAO_STOCK,
  TIER_ORDER,
  gameById,
  gamesByRarity,
  taobaoPrice,
  tierUnlocked,
} from '../../../core';
import type { Attr, Rarity } from '../../../core';
import { useGameStore } from '../../stores/game';
import GameCard from '../../components/GameCard.vue';

const store = useGameStore();

/** 稀有度筛选：null = 全部已解锁级别；属性筛选：null = 全部 */
const rarityFilter = ref<Rarity | null>(null);
const attrFilter = ref<Attr | null>(null);

/** 已解锁的级别（N 恒解锁；集齐上一级全部常规款解锁下一级） */
const unlockedTiers = computed(() => TIER_ORDER.filter(r => tierUnlocked(store.s, r)));

/** 下一档待解锁级别（展示提示用） */
const nextLocked = computed(() => TIER_ORDER.find(r => !tierUnlocked(store.s, r)) ?? null);
const nextLockedPrev = computed(() => {
  const i = TIER_ORDER.indexOf(nextLocked.value as Rarity);
  return i > 0 ? TIER_ORDER[i - 1] : null;
});

const shown = computed(() => {
  const tiers = rarityFilter.value
    ? unlockedTiers.value.filter(r => r === rarityFilter.value)
    : unlockedTiers.value;
  return tiers
    .flatMap(r => [...gamesByRarity(r)])
    .filter(g => !attrFilter.value || g.attrs.includes(attrFilter.value));
});

function stockLeft(id: string): number {
  return store.s.taobaoStock[id] ?? TAOBAO_STOCK[gameById(id).rarity];
}

const headerText = computed(() => {
  const parts = [
    `已解锁级别：${unlockedTiers.value.join(' · ')}`,
    `每款限量 N${TAOBAO_STOCK.N}/R${TAOBAO_STOCK.R}/SR${TAOBAO_STOCK.SR}/SSR${TAOBAO_STOCK.SSR} 件，售完不补（可重复购买同款）`,
  ];
  if (nextLocked.value && nextLockedPrev.value) {
    parts.push(`集齐全部 ${nextLockedPrev.value} 级常规款解锁 ${nextLocked.value} 级`);
  }
  return parts.join(' · ');
});
</script>

<template>
  <div>
    <div class="filter-bar" role="group" aria-label="筛选在售桌游">
      <button
        :aria-pressed="rarityFilter === null"
        @click="rarityFilter = null"
      >
        全部级别
      </button>
      <button
        v-for="r in TIER_ORDER"
        :key="r"
        :aria-pressed="rarityFilter === r"
        :disabled="!unlockedTiers.includes(r)"
        :title="unlockedTiers.includes(r) ? '' : '该级别尚未解锁'"
        @click="rarityFilter = rarityFilter === r ? null : r"
      >
        {{ r }}
      </button>
      <span class="filter-divider" aria-hidden="true"></span>
      <button
        v-for="a in ATTRS"
        :key="a"
        :aria-pressed="attrFilter === a"
        @click="attrFilter = attrFilter === a ? null : a"
      >
        {{ ATTR_ICON[a] }}{{ a }}
      </button>
    </div>
    <div style="grid-column:1/-1;margin-bottom:10px">
      <small class="mut">{{ headerText }}</small>
    </div>
    <div class="grid">
      <div v-if="!shown.length" class="mut" style="grid-column:1/-1">
        {{ rarityFilter && !unlockedTiers.includes(rarityFilter) ? `${rarityFilter} 级尚未解锁。` : '没有符合筛选的桌游。' }}
      </div>
      <GameCard v-for="g in shown" :key="g.id" :game="g" own-badge>
        <div class="tagline">{{ g.tags.join(' · ') }} · {{ g.playTime }}分钟</div>
        <div class="tagline mut">库存 {{ stockLeft(g.id) }}/{{ TAOBAO_STOCK[g.rarity] }}</div>
        <template #actions>
          <div
            v-if="stockLeft(g.id) > 0"
            class="shop-card-action"
          >
            <span class="price">¥{{ taobaoPrice(store.s, g) }}</span>
            <button
              class="primary"
              :disabled="store.s.money < taobaoPrice(store.s, g)"
              @click="store.buyTb(g.id)"
            >
              购买
            </button>
          </div>
          <div v-else class="mut" style="margin-top:6px">已售罄</div>
        </template>
      </GameCard>
    </div>
  </div>
</template>
