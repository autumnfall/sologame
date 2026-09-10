<script setup lang="ts">
import { useGameStore } from '../stores/game';
import type { ShopTabKey } from '../stores/game';
import TaobaoPanel from './shop/TaobaoPanel.vue';
import XianyuPanel from './shop/XianyuPanel.vue';
import GachaPanel from './shop/GachaPanel.vue';

const store = useGameStore();

const SUBTABS: { key: ShopTabKey; label: string }[] = [
  { key: 'taobao', label: '某宝 · 限量' },
  { key: 'xianyu', label: '某鱼 · 二手' },
  { key: 'gacha', label: '某赏 · 抽赏' },
];
</script>

<template>
  <div>
    <div class="subtabs">
      <button
        v-for="t in SUBTABS"
        :key="t.key"
        :class="{ active: store.shopTab === t.key }"
        @click="store.shopTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>
    <TaobaoPanel v-if="store.shopTab === 'taobao'" />
    <XianyuPanel v-else-if="store.shopTab === 'xianyu'" />
    <GachaPanel v-else />
  </div>
</template>
