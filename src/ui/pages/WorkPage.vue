<script setup lang="ts">
import { computed } from 'vue';
import { ATTR_ICON, JOBS, ROMAN, fmt, jobById, jobUnlocked } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

function reqStr(req: Partial<Record<string, number>>): string {
  const entries = Object.entries(req);
  if (!entries.length) return '无门槛';
  return entries.map(([a, lv]) => `${ATTR_ICON[a as keyof typeof ATTR_ICON]}${a} ${ROMAN[lv as number]}`).join(' + ');
}

function payStr(id: string): string {
  const j = jobById(id);
  if (!j) return '';
  if (!j.auto) return '游玩结算给钱';
  const min = j.cycleSec / 60;
  const cycle = Number.isInteger(min) ? `${min} 分钟` : `${(min).toFixed(1)} 分钟`;
  return `每 ${cycle} ¥${j.cyclePay}${j.volatile ? '（±50% 波动）' : ''}`;
}

/** 当前工作的周期进度 0~1 与倒计时 */
const curJob = computed(() => (store.s.job ? jobById(store.s.job) : undefined));
const cyclePct = computed(() =>
  curJob.value?.auto ? Math.min(1, store.s.jobProgress / curJob.value.cycleSec) : 0,
);
const cycleLeft = computed(() =>
  curJob.value?.auto ? Math.max(0, curJob.value.cycleSec - store.s.jobProgress) : 0,
);

/** 换工作会放弃当前周期进度 */
function switchJob(id: string) {
  if (store.s.jobProgress > 0) {
    const left = curJob.value?.auto ? curJob.value.cycleSec - store.s.jobProgress : 0;
    if (!window.confirm(`换工作将放弃当前周期已推进的进度（还剩 ${left} 秒结算），确定换岗？`)) return;
  }
  store.doTakeJob(id);
}
</script>

<template>
  <div>
    <h2>职业阶梯</h2>
    <div v-if="curJob?.auto" class="panel" style="margin-bottom:12px;padding:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <b>▶ {{ curJob.name }}</b>
        <span class="mut">本周期进度 {{ Math.round(cyclePct * 100) }}% · 还剩 {{ cycleLeft }} 秒结算 ¥{{ curJob.cyclePay }}{{ curJob.volatile ? '±' : '' }}</span>
      </div>
      <div class="bar" style="margin-top:6px">
        <i :style="{ width: cyclePct * 100 + '%' }"></i>
      </div>
      <small class="mut">工作自动进行，与玩桌游并行结算；离线也按整周期累积（50% 折算）。</small>
    </div>
    <div>
      <div
        v-for="j in JOBS"
        :key="j.id"
        class="job"
        :class="{ locked: !jobUnlocked(store.s, j.req), current: store.s.job === j.id }"
      >
        <div>
          <div class="jname">{{ store.s.job === j.id ? '▶ ' : '' }}{{ j.name }}</div>
          <div class="mut">门槛：{{ reqStr(j.req) }}</div>
          <div class="mut">{{ payStr(j.id) }} · {{ j.desc }}</div>
        </div>
        <div>
          <button
            v-if="jobUnlocked(store.s, j.req) && store.s.job !== j.id"
            class="primary"
            @click="switchJob(j.id)"
          >
            上岗
          </button>
          <button
            v-else-if="store.s.job === j.id && j.auto"
            class="danger"
            @click="store.doQuitJob()"
          >
            辞职休息
          </button>
          <span v-else-if="store.s.job === j.id" class="mut">当前职业</span>
          <span v-else class="mut">未解锁</span>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <h3>📦 离线收益</h3>
      <div class="mut">离线收益按已解锁职业的整周期累积、按 50% 折算入账，上限 1 小时。</div>
      <div class="mut" style="margin-top:6px">
        <template v-if="store.s.offlineBank.money > 0">
          已累积 <b class="ok">¥{{ fmt(store.s.offlineBank.money) }}</b>（{{ store.bankMinutes }} 分钟，上限 60 分钟）
        </template>
        <template v-else>暂无可领取的离线收益。</template>
      </div>
      <button
        class="primary"
        style="margin-top:8px"
        :disabled="store.s.offlineBank.money <= 0"
        @click="store.claim()"
      >
        领取
      </button>
    </div>
  </div>
</template>
