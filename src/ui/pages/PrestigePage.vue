<script setup lang="ts">
import { computed } from 'vue';
import {
  ACHIEVEMENTS,
  FEATURE_UNLOCKS,
  PERKS,
  PERK_BRANCH_NAME,
  achievedCount,
  canPrestige,
  insightGain,
  insightSpent,
  isFeatureUnlocked,
  masteredCount,
  perkCost,
  perkLevel,
  prestigeUnlockCount,
  prestigeWeight,
} from '../../core';
import type { PerkBranch } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const unlockNeed = prestigeUnlockCount();
const mastered = computed(() => masteredCount(store.s));
const unlocked = computed(() => canPrestige(store.s));
const gain = computed(() => insightGain(store.s));
const weight = computed(() => prestigeWeight(store.s));
const spent = computed(() => insightSpent(store.s));

const BRANCHES: PerkBranch[] = ['collect', 'efficiency', 'commerce'];
const perksByBranch = (b: PerkBranch) => PERKS.filter(p => p.branch === b);

function lv(id: string): number {
  return perkLevel(store.s, id);
}

function cost(id: string): number {
  const def = PERKS.find(p => p.id === id)!;
  return perkCost(def, lv(id));
}

// ---------- 成就 ----------
const achCount = computed(() => achievedCount(store.s));
const achList = computed(() => {
  const done = new Set(store.s.achievements);
  return [...ACHIEVEMENTS].sort((a, b) => Number(done.has(b.id)) - Number(done.has(a.id)));
});
const nextUnlock = computed(() => FEATURE_UNLOCKS.find(f => achCount.value < f.need) ?? null);
</script>

<template>
  <div>
    <h2>🌅 退坑转生</h2>

    <div v-if="store.pendingStarter" class="panel" style="margin-bottom:12px;border-color:var(--gold)">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div>
          <b>🌅 第 {{ store.s.prestige.runs + 1 }} 周目待开启</b>
          <div class="mut" style="margin-top:4px;font-size:12px">
            阅历已到账：{{ store.s.prestige.insight }} 点。先投资下方的天赋（如「老友馈赠」需在开局前持有），准备好后点击右侧按钮开始三选一。
          </div>
        </div>
        <button class="primary" style="margin-left:auto" @click="store.startNewRun()">🌅 开启新周目（三选一）</button>
      </div>
    </div>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div>
          <div>当前周目：已精通 <b>{{ mastered }}</b> / 解锁需 {{ unlockNeed }} 款 · 转生权重 <b>{{ weight }}</b></div>
          <div class="mut" style="margin-top:4px;font-size:12px">
            权重 = 精通桌游按稀有度累计（隐藏款额外加成）+ 图鉴数量加成；阅历 = √权重 × 系数，首转有保底、之后每周目至少多 1。
          </div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div v-if="unlocked" style="font-size:15px">
            本次退坑可获得 <b class="price" style="font-size:20px">{{ gain }}</b> 阅历
          </div>
          <div v-else class="mut">再精通 {{ unlockNeed - mastered }} 款桌游即可退坑</div>
          <button class="primary" style="margin-top:6px" :disabled="!unlocked" @click="store.prestige()">
            🌅 退坑出清，开启新周目
          </button>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span>🌅 桌游阅历：<b class="price" style="font-size:18px">{{ store.s.prestige.insight }}</b></span>
        <span class="mut">已投入 {{ spent }} · 已完成 {{ store.s.prestige.runs }} 周目</span>
        <button style="margin-left:auto" :disabled="spent === 0" @click="store.respec()">↺ 洗点（全额退还）</button>
      </div>
      <div class="mut" style="margin-top:6px;font-size:12px">
        退坑会重置本周目的收藏、实体、金钱、属性、职业与槽位；阅历、天赋和生涯统计永久保留。天赋按三条线取舍投资，可随时洗点重分。
      </div>
    </div>

    <div class="panel" style="margin-bottom:12px">
      <h3 style="margin:0 0 8px">🏆 成就 <small class="mut">{{ achCount }}/{{ ACHIEVEMENTS.length }} · 全局经验 +{{ achCount }}%（无上限）</small></h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <span
          v-for="f in FEATURE_UNLOCKS"
          :key="f.key"
          class="mut"
          style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:2px 8px"
          :style="isFeatureUnlocked(store.s, f.key) ? { borderColor: 'var(--green)', color: 'var(--green)' } : {}"
          :title="f.desc"
        >
          {{ isFeatureUnlocked(store.s, f.key) ? '✓' : `${achCount}/${f.need}` }} {{ f.name }}
        </span>
      </div>
      <div v-if="nextUnlock" class="mut" style="font-size:12px;margin-bottom:8px">
        再达成 {{ nextUnlock.need - achCount }} 个成就解锁「{{ nextUnlock.name }}」：{{ nextUnlock.desc }}
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
        <div
          v-for="a in achList"
          :key="a.id"
          class="panel"
          style="padding:8px;margin:0"
          :style="store.s.achievements.includes(a.id) ? { borderColor: 'var(--gold)' } : { opacity: 0.55 }"
        >
          <b style="font-size:12px">{{ store.s.achievements.includes(a.id) ? '🏆 ' : '🔒 ' }}{{ a.name }}</b>
          <div class="tagline">{{ a.desc }}</div>
        </div>
      </div>
    </div>

    <div v-for="b in BRANCHES" :key="b" class="panel" style="margin-bottom:12px">
      <h3 style="margin:0 0 8px">{{ PERK_BRANCH_NAME[b] }}</h3>
      <div class="grid">
        <div v-for="p in perksByBranch(b)" :key="p.id" class="card" style="border-top:3px solid var(--gold);padding:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>{{ p.name }}</b>
            <span class="mut" style="font-size:11px">{{ lv(p.id) }}/{{ p.max }}</span>
          </div>
          <div class="tagline" style="margin:4px 0">{{ p.desc }}</div>
          <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
            <span v-if="lv(p.id) >= p.max" class="ok" style="font-size:12px">已满级</span>
            <template v-else>
              <span class="price" style="font-size:13px">🌅 {{ cost(p.id) }}</span>
              <button
                class="primary"
                :disabled="store.s.prestige.insight < cost(p.id)"
                @click="store.buyPerk(p.id)"
              >
                升级
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
