<script setup lang="ts">
import { gameById, gainText } from '../../core';
import { useGameStore } from '../stores/game';
import GameCard from './GameCard.vue';

const store = useGameStore();

// 开局三选一：果园（演算）/ 绝顶聪明（应变骰子）/ 咖啡烘焙师（运筹袋抓）
const STARTER_IDS = ['guoyuan', 'zongming', 'kafei'];
const starters = STARTER_IDS.map(id => gameById(id));
</script>

<template>
  <div v-if="store.showStarter" id="modal-mask">
    <div id="modal">
      <h2>🎁 欢迎来到桌游收藏家的世界！</h2>
      <p class="mut" style="margin-bottom:12px">从朋友留下的三盒毛线桌游中选一盒作为你的起点——它将决定你前期的成长方向。</p>
      <div class="grid" style="grid-template-columns:repeat(3,1fr)">
        <GameCard v-for="g in starters" :key="g.id" :game="g">
          <div>{{ g.tags.join(' · ') }}</div>
          <div class="tagline">每局 {{ gainText(g) }}</div>
          <template #actions>
            <div style="margin-top:6px">
              <button class="primary" style="width:100%" @click="store.pickStarter(g.id)">就选它</button>
            </div>
          </template>
        </GameCard>
      </div>
    </div>
  </div>
</template>
