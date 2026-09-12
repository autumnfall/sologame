<script setup lang="ts">
import { PERKS, PERK_BRANCH_NAME, insightSpent, perkCost } from '../../core';
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
  return lv(id) < def.max && store.s.prestige.insight >= perkCost(def, lv(id));
}

const perksByBranch = (b: PerkBranch) => PERKS.filter(p => p.branch === b);
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
          <button
            style="padding:3px 12px;font-size:12px;flex-shrink:0"
            :disabled="!canBuy(p.id)"
            @click="store.buyPerk(p.id)"
          >
            <template v-if="lv(p.id) >= p.max">已满级</template>
            <template v-else>🌅 {{ perkCost(p, lv(p.id)) }}</template>
          </button>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button :disabled="insightSpent(store.s) === 0" @click="store.respec()">↺ 洗点（全额退还）</button>
        <button class="primary" style="flex:1;min-width:220px" @click="store.startNewRun()">
          🌅 开启新周目（三选一）
        </button>
      </div>
      <small class="mut" style="display:block;margin-top:6px">天赋与洗点仅在此界面可调整，开启新周目后本周目内锁定。</small>
    </div>
  </div>
</template>
