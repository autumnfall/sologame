<script setup lang="ts">
import { computed } from 'vue';
import {
  CHALLENGES,
  PERKS,
  PERK_BRANCH_NAME,
  challengeAvailable,
  insightSpent,
  perkCost,
  perkPrereqMet,
} from '../../core';
import type { PerkBranch } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

const BRANCHES: PerkBranch[] = ['collect', 'efficiency', 'commerce'];

function lv(id: string): number {
  return store.s.prestige.perks[id] ?? 0;
}

function defOf(id: string) {
  return PERKS.find(p => p.id === id)!;
}

function canBuy(id: string): boolean {
  const def = defOf(id);
  return perkPrereqMet(store.s, def) && lv(id) < def.max && store.s.prestige.insight >= perkCost(def, lv(id));
}

/** 前置未满足：显示 🔒 与前置名 */
function lockText(id: string): string {
  const def = defOf(id);
  if (!def.after || perkPrereqMet(store.s, def)) return '';
  return `🔒 需先点「${defOf(def.after).name}」1 级`;
}

const perksByBranch = (b: PerkBranch) => PERKS.filter(p => p.branch === b);

// ---------- 下周目挑战（单选，写入 prestige.pendingChallenge，开新周目时生效） ----------

const selectableChallenges = computed(() =>
  CHALLENGES.filter(c => challengeAvailable(store.s, c.id) && !store.s.prestige.challengeDone.includes(c.id)),
);

function pickChallenge(id: string | null) {
  store.selectPendingChallenge(id);
}
</script>

<template>
  <!-- 转生后强制弹窗：先投资阅历，点「开启新周目」才能继续（遮罩不可点击关闭） -->
  <div v-if="store.pendingStarter" id="modal-mask">
    <div id="modal" style="max-width:660px">
      <h3 style="margin-top:0">🌅 第 {{ store.s.prestige.runs + 1 }} 周目 · 投资阅历</h3>
      <p class="mut" style="margin-bottom:12px">
        本次退坑到账阅历已可使用（当前 <b class="price">{{ store.s.prestige.insight }}</b> 点）。
        「启动资金」「老主顾」在选定开局桌游时结算，「老友馈赠」需在本界面提前持有——点下方按钮前买好。
      </p>
      <div v-for="b in BRANCHES" :key="b" style="margin-bottom:12px">
        <b style="font-size:13px">{{ PERK_BRANCH_NAME[b] }}</b>
        <div
          v-for="p in perksByBranch(b)"
          :key="p.id"
          style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding:6px 0"
        >
          <span style="min-width:150px">
            <b style="font-size:13px">{{ p.name }}</b>
            <small class="mut" style="margin-left:6px">{{ lv(p.id) }}/{{ p.max }}</small>
          </span>
          <small class="mut" style="flex:1;min-width:220px">{{ p.desc }}</small>
          <small v-if="lockText(p.id)" class="mut" style="flex-shrink:0;color:var(--dim);font-size:11px">{{ lockText(p.id) }}</small>
          <button
            style="padding:3px 12px;font-size:12px;flex-shrink:0"
            :disabled="!canBuy(p.id)"
            :title="lockText(p.id) || undefined"
            @click="store.buyPerk(p.id)"
          >
            <template v-if="lv(p.id) >= p.max">已满级</template>
            <template v-else>🌅 {{ perkCost(p, lv(p.id)) }}</template>
          </button>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <b style="font-size:13px">🎯 下周目挑战 <small class="mut">单选，可选「无挑战」；选定后新周目开局即生效，持续整周目不可放弃</small></b>
        <div style="border-top:1px solid var(--line);padding:6px 0">
          <label style="display:flex;gap:8px;align-items:center;cursor:pointer;padding:3px 0">
            <input
              type="radio"
              name="pending-challenge"
              :checked="store.s.prestige.pendingChallenge === null"
              @change="pickChallenge(null)"
            />
            <span style="font-size:13px">无挑战 <small class="mut">正常游玩</small></span>
          </label>
          <label
            v-for="c in selectableChallenges"
            :key="c.id"
            style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;padding:3px 0"
          >
            <input
              type="radio"
              name="pending-challenge"
              style="margin-top:3px"
              :checked="store.s.prestige.pendingChallenge === c.id"
              @change="pickChallenge(c.id)"
            />
            <span style="font-size:13px">
              {{ c.name }} <span class="price">🪙 {{ c.reward }}</span>
              <small class="mut" style="display:block">{{ c.desc }}</small>
            </span>
          </label>
          <small v-if="!selectableChallenges.length" class="mut">暂无可选挑战（未完成前置或已全部完成）。</small>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button :disabled="insightSpent(store.s) === 0" @click="store.respec()">↺ 洗点（全额退还）</button>
        <button class="primary" style="flex:1;min-width:220px" @click="store.startNewRun()">
          🌅 开启新周目（三选一）
        </button>
      </div>
      <small class="mut" style="display:block;margin-top:6px">天赋与洗点仅在此界面可调整，开启新周目后本周目内锁定；挑战选择同样在开启新周目时锁定。</small>
    </div>
  </div>
</template>
