<script setup lang="ts">
import { ATTR_ICON, JOBS, ROMAN, fmt, jobUnlocked } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

function reqStr(req: Partial<Record<string, number>>): string {
  const entries = Object.entries(req);
  if (!entries.length) return '无门槛';
  return entries.map(([a, lv]) => `${ATTR_ICON[a as keyof typeof ATTR_ICON]}${a} ${ROMAN[lv as number]}`).join(' + ');
}
</script>

<template>
  <div>
    <h2>职业阶梯</h2>
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
          <div class="mut">{{ j.desc }}</div>
        </div>
        <div>
          <button
            v-if="jobUnlocked(store.s, j.req) && store.s.job !== j.id"
            class="primary"
            @click="store.doTakeJob(j.id)"
          >
            上岗
          </button>
          <button
            v-else-if="store.s.job === j.id"
            class="danger"
            @click="store.doQuitJob()"
          >
            辞职休息
          </button>
          <span v-else class="mut">未解锁</span>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:14px">
      <h3>📦 离线收益</h3>
      <div class="mut">离线收益由已解锁的自动工作累积，上限 1 小时。</div>
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
