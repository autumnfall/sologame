<script setup lang="ts">
import { gainText, gameById, xianyuPriceRatio } from '../../../core';
import { useGameStore } from '../../stores/game';
import GameCard from '../../components/GameCard.vue';

const store = useGameStore();

function ratioCls(item: { id: string; price: number }): string {
  const pct = xianyuPriceRatio(item);
  return pct < 90 ? 'ok' : pct > 130 ? 'bad2' : '';
}
</script>

<template>
  <div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
      <button @click="store.refreshXy(true)">🔄 刷新货源（¥20）</button>
      <small class="mut">
        每批 3~5 件，价格为市场价 50%~200%；可跨级别刷出高级桌游，偶见隐藏款！每 5 分钟自动到货（<b>{{ store.xyCd }}</b>）
      </small>
    </div>
    <div v-if="!store.s.xianyu.length" class="mut">货架空空，点上方按钮刷新一批货源。</div>
    <div v-else class="grid">
      <GameCard v-for="(it, i) in store.s.xianyu" :key="it.id + i" :game="gameById(it.id)">
        <span v-if="gameById(it.id).hidden" class="oop-tag">隐藏款 · {{ gameById(it.id).affix?.desc }}</span>
        <div class="tagline">
          市场价 ¥{{ gameById(it.id).marketPrice }}（本件 {{ xianyuPriceRatio(it) }}%）· 每局 {{ gainText(gameById(it.id)) }}
        </div>
        <template #actions>
          <div
            v-if="store.s.owned[it.id] && store.s.owned[it.id].count > 0"
            class="mut"
            style="margin-top:6px"
          >
            ✓ 已收藏（不可购买）
          </div>
          <div
            v-else
            style="margin-top:6px;display:flex;justify-content:space-between;align-items:center"
          >
            <span class="price" :class="ratioCls(it)">¥{{ it.price }}</span>
            <button class="primary" :disabled="store.s.money < it.price" @click="store.buyXy(i)">拿下</button>
          </div>
        </template>
      </GameCard>
    </div>
  </div>
</template>
