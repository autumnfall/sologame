<script setup lang="ts">
import GameDialog from './GameDialog.vue';
import { gameById, gainText } from '../../core';
import { useGameStore } from '../stores/game';
import GameCard from './GameCard.vue';

const store = useGameStore();

// 开局三选一：果园（演算）/ 绝顶聪明（应变骰子）/ 咖啡烘焙师（运筹袋抓）
const STARTER_IDS = ['guoyuan', 'zongming', 'kafei'];
const starters = STARTER_IDS.map(id => gameById(id));
</script>

<template>
  <GameDialog v-if="store.showStarter" label="选择开局桌游" class="starter-dialog">
      <h2>选一盒作为起点</h2>
      <p class="mut" style="margin-bottom:12px">三盒桌游各有擅长的属性。选你最想开玩的那盒。</p>
      <div class="grid starter-grid">
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
  </GameDialog>
</template>
