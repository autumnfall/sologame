<script setup lang="ts">
import { computed } from 'vue';
import { ATTR_ICON, OFFLINE_CAP_MS, conditionText, fmt, gameById } from '../../core';
import type { Attr } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();
const b = computed(() => store.s.offlineBank);

/** 总体进度条：离线时长占上限比例 */
const totalPct = computed(() => Math.min(100, (b.value.t / OFFLINE_CAP_MS) * 100));

const expLines = computed(() =>
  (Object.entries(b.value.exp) as [Attr, number][])
    .filter(([, v]) => v > 0)
    .map(([a, v]) => `${ATTR_ICON[a]}${a} +${v.toFixed(1)}`),
);

const gameRows = computed(() =>
  [...b.value.games]
    .sort((x, y) => y.rounds - x.rounds)
    .map(g => {
      const game = gameById(g.gameId);
      const copy = store.s.copies.find(c => c.gameId === g.gameId);
      return {
        name: game.name,
        icon: game.icon,
        rounds: g.rounds,
        wear: g.wear,
        cond: copy ? conditionText(copy.durability, game.rarity) : null,
      };
    }),
);

const hasWork = computed(() => b.value.workMoney > 0);
const hasPlay = computed(() => b.value.playRounds > 0);
</script>

<template>
  <div v-if="store.showOffline" id="modal-mask">
    <div id="modal" style="max-width:520px">
      <h3 style="margin-top:0">🌙 欢迎回来</h3>
      <p class="mut" style="margin:0 0 8px">你离线了 <b>{{ store.offlineTime }}</b>，收益已自动入账：</p>
      <div class="bar" style="height:10px;margin-bottom:12px">
        <i :style="{ width: totalPct + '%' }"></i>
      </div>

      <div v-if="hasWork" class="panel" style="margin-bottom:8px">
        💼 工作：<b class="price">¥{{ fmt(b.workMoney) }}</b>
        <span class="mut">（{{ b.workCycles }} 个周期，已按离线折算）</span>
      </div>

      <div v-if="hasPlay" class="panel" style="margin-bottom:8px">
        🎲 游玩：自动连刷 <b>{{ b.playRounds }}</b> 局，收入 <b class="price">¥{{ fmt(b.playMoney) }}</b>
        <div v-if="expLines.length" style="margin-top:4px">经验：{{ expLines.join('　') }}</div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-top:6px">
          <div v-for="r in gameRows" :key="r.name" style="display:flex;gap:6px;font-size:12px">
            <span>{{ r.icon }}《{{ r.name }}》×{{ r.rounds }} 局</span>
            <span class="mut">耐久 -{{ Number.isInteger(r.wear) ? r.wear : r.wear.toFixed(1) }}</span>
            <span v-if="r.cond" class="mut">（现 {{ r.cond }}）</span>
          </div>
        </div>
      </div>
      <div v-if="!hasWork && !hasPlay" class="mut" style="margin-bottom:8px">
        这段时间没有产生收益——下次离线前记得上岗一份工作、手头留几盒桌游。
      </div>

      <button class="primary" style="width:100%" @click="store.closeOffline()">收下，继续玩</button>
    </div>
  </div>
</template>
