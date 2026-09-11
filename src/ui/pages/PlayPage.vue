<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { DURABILITY, conditionText, copiesOf, copyByUid, gainText, gameById, isFeatureUnlocked, masteryText } from '../../core';
import { useGameStore } from '../stores/game';
import FilterBar from '../components/FilterBar.vue';
import GameCard from '../components/GameCard.vue';

const store = useGameStore();
const ps = computed(() => store.session);

const ownedIds = computed(() =>
  Object.keys(store.s.collections).filter(
    id =>
      store.s.collections[id].firstOpened &&
      copiesOf(store.s, id).length > 0 &&
      (!store.playFilter || gameById(id).attrs.includes(store.playFilter)),
  ),
);

/** 实体序号：①②③…（超过 10 用 (11) 兜底） */
function circled(i: number): string {
  return i < 10 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`;
}

/** 某实体在同款全部实体中的序号（0 起） */
function copyIndex(uid: number): number {
  const c = copyByUid(store.s, uid);
  if (!c) return 0;
  return store.s.copies.filter(x => x.gameId === c.gameId).findIndex(x => x.uid === uid);
}

function durText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const pendingCopies = computed(() => (store.pendingCopyPick ? copiesOf(store.s, store.pendingCopyPick) : []));

/** 自动更换开关（成就里程碑解锁，两档互斥） */
const fatigueUnlocked = computed(() => isFeatureUnlocked(store.s, 'autoFatigue'));
const masteryUnlocked = computed(() => isFeatureUnlocked(store.s, 'autoMastery'));
const autoMode = computed(() => store.s.settings.autoSwitch);

const panelTitle = computed(() => {
  const s = ps.value;
  if (!s) return '';
  const g = gameById(s.gameId);
  const copy = s.copyUid != null ? copyByUid(store.s, s.copyUid) : undefined;
  const copyStr = copy
    ? ` · 实体${circled(copyIndex(copy.uid))} · ${conditionText(copy.durability, g.rarity)}`
    : '';
  return `${g.icon} ${g.name}${copyStr} · 第 ${s.round} 局（自动连刷中）`;
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
    <!-- 游玩中：进度面板固定在页面顶部，选游戏列表在下方 -->
    <div v-if="ps" id="play-panel">
      <h3 style="margin-top:0">{{ panelTitle }}</h3>
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

    <h2>选择一款桌游开玩</h2>
    <FilterBar v-model="store.playFilter" />
    <div v-if="fatigueUnlocked || masteryUnlocked" style="margin:0 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <small class="mut">连刷自动更换（互斥）：</small>
      <button
        v-if="fatigueUnlocked"
        :class="{ primary: autoMode === 'fatigue' }"
        @click="store.toggleAutoSwitch('fatigue')"
      >
        {{ autoMode === 'fatigue' ? '✓ ' : '' }}玩腻了换
      </button>
      <button
        v-if="masteryUnlocked"
        :class="{ primary: autoMode === 'mastery' }"
        @click="store.toggleAutoSwitch('mastery')"
      >
        {{ autoMode === 'mastery' ? '✓ ' : '' }}精通后换
      </button>
      <small v-if="autoMode !== 'off'" class="mut">已开启；再点一次关闭</small>
    </div>

    <div v-if="!ownedIds.length" class="mut">
      {{ store.playFilter ? '该属性下没有可玩的桌游，换个筛选看看。' : '还没有桌游，先去商店看看吧。' }}
    </div>
    <div v-else class="grid">
      <GameCard v-for="id in ownedIds" :key="id" :game="gameById(id)">
        <div>复杂度 {{ gameById(id).weight }} · {{ gameById(id).playTime }}分钟 · 每局 {{ gainText(gameById(id)) }}</div>
        <div class="tagline">
          {{ masteryText(store.s, gameById(id)) }} · ×{{ copiesOf(store.s, id).length }} 实体
        </div>
        <template #actions>
          <div style="margin-top:6px">
            <button
              v-if="!ps"
              class="primary"
              style="width:100%"
              @click="store.requestPlay(id)"
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

    <!-- 多实体选择器 -->
    <div v-if="store.pendingCopyPick" id="modal-mask" @click.self="store.cancelCopyPick()">
      <div id="modal">
        <h3>选择要玩的实体</h3>
        <p class="mut" style="margin-bottom:10px">
          《{{ gameById(store.pendingCopyPick).name }}》有多个实体，成色与耐久各不相同：
        </p>
        <div
          v-for="(c, i) in pendingCopies"
          :key="c.uid"
          class="panel"
          style="margin-bottom:8px;cursor:pointer"
          @click="store.pickCopy(c.uid)"
        >
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <span>
              <b>实体{{ circled(i) }}</b> · {{ conditionText(c.durability, gameById(c.gameId).rarity) }}
              {{ c.sleeved ? ' · 🎴已套牌套' : '' }}{{ c.stored ? ' · 📦已收纳' : '' }}
            </span>
            <small class="mut">
              耐久 {{ durText(c.durability) }}/{{ DURABILITY[gameById(c.gameId).rarity] }}
            </small>
          </div>
          <div
            style="height:5px;background:#111;border-radius:3px;overflow:hidden;margin-top:6px"
          >
            <i
              style="display:block;height:100%"
              :style="{
                width: Math.min(100, Math.round((c.durability / DURABILITY[gameById(c.gameId).rarity]) * 1000) / 10) + '%',
                background: c.durability <= 0 ? 'var(--red)' : 'var(--green)',
              }"
            ></i>
          </div>
        </div>
        <button style="margin-top:6px" @click="store.cancelCopyPick()">取消</button>
      </div>
    </div>
  </div>
</template>
