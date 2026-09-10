<script setup lang="ts">
import { GACHA_PITY, GACHA_PRICE } from '../../../core';
import type { Rarity } from '../../../core';
import { useGameStore } from '../../stores/game';
const store = useGameStore();

const RAR_COLOR: Record<Rarity, string> = {
  N: 'var(--N)',
  R: 'var(--R)',
  SR: 'var(--SR)',
  SSR: 'var(--SSR)',
};
</script>

<template>
  <div>
    <div class="gacha-banner">
      <div style="font-size:18px;font-weight:800;color:var(--gold)">🎁 某赏 · 一番抽</div>
      <div class="mut" style="margin:6px 0">概率 N 62% / R 28% / SR 8% / SSR 2% · 50 抽硬保底 SSR</div>
      <div>SSR 保底进度：<b class="warn">{{ store.s.pity }} / {{ GACHA_PITY }}</b></div>
      <div style="margin-top:10px;display:flex;gap:10px;justify-content:center">
        <button class="primary" @click="store.pullGacha(false)">单抽（¥{{ GACHA_PRICE }}）</button>
        <button class="primary" @click="store.pullGacha(true)">用抽赏券 ×1 抽</button>
      </div>
      <small>重复桌游不再给库存，直接转牌套（N ×5 包 / R ×10 包 / SR ×20 包 / SSR ×40 包，每包 50 张）并叠加该桌游熟练度（N+4 / R+8 / SR+16 / SSR+32）。</small>
    </div>
    <div class="logbox" style="height:120px">
      <div v-for="(e, i) in store.gachaLog" :key="i" :class="e.cls">
        [{{ e.rar }}]
        <template v-if="e.dup">重复 {{ e.rar }}《{{ e.name }}》{{ e.text }}</template>
        <template v-else><b :style="{ color: RAR_COLOR[e.rar] }">{{ e.rar }}</b>《{{ e.name }}》{{ e.text }}</template>
      </div>
    </div>
  </div>
</template>
