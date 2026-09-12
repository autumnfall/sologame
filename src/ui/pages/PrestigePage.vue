<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  ACHIEVEMENTS,
  FEATURE_UNLOCKS,
  PERKS,
  PERK_BRANCH_NAME,
  achievedCount,
  canPrestige,
  fmtDuration,
  insightGain,
  insightSpent,
  isFeatureUnlocked,
  masteredCount,
  perkCost,
  perkLevel,
  prestigeUnlockCount,
  prestigeWeight,
} from '../../core';
import type { PerkBranch, RunRecord } from '../../core';
import { useGameStore } from '../stores/game';
import { LEADERBOARD_API, fetchBoard } from '../leaderboard';

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

// ---------- 排行榜 ----------
const onlineBoard = ref<RunRecord[] | null>(null);
const boardStatus = ref('');

async function refreshBoard() {
  if (!LEADERBOARD_API) {
    onlineBoard.value = null;
    boardStatus.value = '在线排行榜未配置服务器（部署 scripts/leaderboard-server.js 后填入地址即可开启）';
    return;
  }
  boardStatus.value = '加载中…';
  onlineBoard.value = await fetchBoard();
  boardStatus.value = onlineBoard.value ? '' : '无法连接排行榜服务器，仅展示本地榜';
}

onMounted(refreshBoard);

function boardName(r: RunRecord): string {
  return r.name.trim() || '无名收藏家';
}
</script>

<template>
  <div>
    <h2>🌅 退坑转生</h2>

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
        <label style="margin-left:auto;display:flex;gap:6px;align-items:center;font-size:13px">
          玩家名称
          <input
            v-model="store.s.playerName"
            maxlength="24"
            placeholder="排行榜展示用，可留空"
            style="background:var(--panel2);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:5px 10px;font-size:13px;width:200px"
            @change="store.saveGame()"
          />
        </label>
      </div>
      <div class="mut" style="margin-top:6px;font-size:12px">
        退坑会重置本周目的收藏、实体、金钱、属性、职业与槽位；阅历、天赋和生涯统计永久保留。天赋按三条线取舍投资，<b>只能在转生后、开启新周目前购买与洗点</b>（弹窗内操作），本周目内锁定。退坑时会把本周目耗时记入排行榜。
      </div>
    </div>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <h3 style="margin:0">🥇 排行榜 <small class="mut">周目完成耗时最短的前 10 名</small></h3>
        <button v-if="LEADERBOARD_API" style="margin-left:auto;padding:3px 10px;font-size:12px" @click="refreshBoard()">🔄 刷新在线榜</button>
      </div>
      <div :class="LEADERBOARD_API ? 'two-col' : ''">
        <div>
          <h3 style="margin:0 0 6px;font-size:13px">本存档 <small class="mut">{{ store.s.localBoard.length }}/10</small></h3>
          <table v-if="store.s.localBoard.length" style="width:100%;border-collapse:collapse;font-size:12px">
            <tr class="mut" style="text-align:left">
              <th style="padding:3px 4px">#</th><th>名称</th><th>耗时</th><th>周目</th><th>阅历</th><th>成就</th>
            </tr>
            <tr v-for="(r, i) in store.s.localBoard" :key="r.at + '-' + i" style="border-top:1px solid var(--line)">
              <td style="padding:3px 4px">{{ i + 1 }}</td>
              <td>{{ boardName(r) }}</td>
              <td>{{ fmtDuration(r.ms) }}</td>
              <td>{{ r.runs }}</td>
              <td>{{ r.insight }}</td>
              <td>{{ r.achievements }}</td>
            </tr>
          </table>
          <div v-else class="mut" style="font-size:12px">还没有完成的周目。</div>
        </div>
        <div v-if="LEADERBOARD_API">
          <h3 style="margin:0 0 6px;font-size:13px">在线 <small class="mut">全部玩家</small></h3>
          <table v-if="onlineBoard && onlineBoard.length" style="width:100%;border-collapse:collapse;font-size:12px">
            <tr class="mut" style="text-align:left">
              <th style="padding:3px 4px">#</th><th>名称</th><th>耗时</th><th>周目</th><th>阅历</th><th>成就</th>
            </tr>
            <tr v-for="(r, i) in onlineBoard" :key="(r.clientId ?? r.at) + '-' + i" style="border-top:1px solid var(--line)">
              <td style="padding:3px 4px">{{ i + 1 }}</td>
              <td>{{ boardName(r) }}</td>
              <td>{{ fmtDuration(r.ms) }}</td>
              <td>{{ r.runs }}</td>
              <td>{{ r.insight }}</td>
              <td>{{ r.achievements }}</td>
            </tr>
          </table>
          <div v-else class="mut" style="font-size:12px">{{ boardStatus || '加载中…' }}</div>
        </div>
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
                disabled
                title="仅在转生后、开启新周目前的准备弹窗中可升级"
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
