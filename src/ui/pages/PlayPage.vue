<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { gainText, gameById, masteryText } from '../../core';
import { useGameStore } from '../stores/game';
import FilterBar from '../components/FilterBar.vue';
import GameCard from '../components/GameCard.vue';

const store = useGameStore();
const ps = computed(() => store.session);

const ownedIds = computed(() =>
  Object.keys(store.s.owned).filter(
    id => store.s.owned[id].count > 0 && (!store.playFilter || gameById(id).attrs.includes(store.playFilter)),
  ),
);

const panelTitle = computed(() => {
  const s = ps.value;
  if (!s) return '';
  const g = gameById(s.gameId);
  return `${g.icon} ${g.name} · 第 ${s.round} 局（自动连刷中）`;
});

/** 时机条是否正在该段上运行（决定 gzone/cursor 显隐） */
function isTimingActive(i: number): boolean {
  const s = ps.value;
  return !!s && !!s.timing && s.timing.phaseIdx === i && !s.timing.judged;
}

// 日志框自动滚到底
const logEl = ref<HTMLElement | null>(null);
watch(
  () => store.playLog.length,
  async () => {
    await nextTick();
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
  },
);
</script>

<template>
  <div>
    <h2>选择一款桌游开玩</h2>
    <FilterBar v-model="store.playFilter" />

    <div v-if="!ownedIds.length" class="mut">
      {{ store.playFilter ? '该属性下没有桌游，换个筛选看看。' : '还没有桌游，先去商店看看吧。' }}
    </div>
    <div v-else class="grid">
      <GameCard v-for="id in ownedIds" :key="id" :game="gameById(id)">
        <div>复杂度 {{ gameById(id).weight }} · {{ gameById(id).playTime }}分钟 · 每局 {{ gainText(gameById(id)) }}</div>
        <div class="tagline">
          {{ masteryText(store.s, gameById(id)) }} · 疲劳 {{ store.s.owned[id].fatigue
          }}{{ store.s.owned[id].sleeved ? ' · 🎴已套' : '' }}{{ store.s.owned[id].stored ? ' · 📦收纳' : '' }} · ×{{ store.s.owned[id].count }}
        </div>
        <template #actions>
          <div style="margin-top:6px">
            <button
              v-if="!ps"
              class="primary"
              style="width:100%"
              @click="store.startPlay(id)"
            >
              ▶ 开玩（自动连刷）
            </button>
            <button
              v-else-if="ps.gameId === id && !ps.nextId"
              style="width:100%"
              disabled
            >
              ▶ 进行中…
            </button>
            <button
              v-else
              style="width:100%"
              :class="{ primary: ps.nextId !== id }"
              @click="store.switchPlay(id)"
            >
              {{ ps.nextId === id ? '✓ 下轮换它' : '🔁 下轮换它' }}
            </button>
          </div>
        </template>
      </GameCard>
    </div>

    <div v-if="ps" id="play-panel">
      <h3>{{ panelTitle }}</h3>
      <div>
        <div v-for="(p, i) in ps.phases" :key="p.key" class="phase-row">
          <span class="plabel">{{ p.name }}</span>
          <div
            class="pbar"
            :class="{ active: isTimingActive(i), done: p.done || p.total <= 0 }"
            @click="store.judgeTiming()"
          >
            <div class="fill" :style="{ width: p.pct + '%' }"></div>
            <div
              v-if="isTimingActive(i) && ps.timing"
              class="gzone"
              :style="{ left: ps.timing.zl + '%', width: ps.timing.zw + '%' }"
            ></div>
            <div
              v-if="isTimingActive(i) && ps.timing"
              class="cursor"
              :style="{ left: ps.timing.pos + '%' }"
            ></div>
          </div>
          <span class="presult">
            <span v-if="p.total <= 0" class="mut">跳过</span>
            <template v-else-if="p.done || p.hit !== null">
              <span v-if="p.hit" class="ok">命中+50%</span>
              <span v-else class="mut">普通</span>
            </template>
          </span>
        </div>
      </div>
      <div ref="logEl" class="logbox">
        <div v-for="(line, i) in store.playLog" :key="i" :class="line.cls">{{ line.text }}</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
        <button :disabled="ps.stopAfter" @click="store.stopAfterRound()">⏹ 本轮结算后停止</button>
        <button class="danger" @click="store.cancelPlay()">立即放弃本轮（无收益）</button>
        <small class="mut">连刷中：在下方列表点「下轮换它」即可在本轮结束后换游戏</small>
      </div>
    </div>
  </div>
</template>
