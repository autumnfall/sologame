<script setup lang="ts">
import { computed } from 'vue';
import {
  CHALLENGES,
  CHALLENGE_SHOP,
  CHALLENGE_SHOP_LINE_NAME,
  challengeAvailable,
  challengeShopCost,
  challengeShopDefById,
  challengeShopLevel,
  challengeShopPrereqMet,
} from '../../core';
import type { ChallengeDef, ChallengeShopLine, GoalType } from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

// ---------- 挑战树（三层展示） ----------

/** 层数 = 1 + 前置链最大层（数据无环） */
function layerOf(id: string): number {
  const def = CHALLENGES.find(c => c.id === id)!;
  if (!def.requires?.length) return 1;
  return 1 + Math.max(...def.requires.map(r => layerOf(r)));
}

const LAYERS = [1, 2, 3];
const challengesByLayer = (n: number) => CHALLENGES.filter(c => layerOf(c.id) === n);

const GOAL_TEXT: Record<GoalType, (target: number) => string> = {
  xyEarn: t => `某鱼卖出净额 ¥${t}`,
  bargainBuys: t => `捡漏 ${t} 次`,
  masteryCount: t => `精通 ${t} 款桌游`,
  plays: t => `游玩 ${t} 局`,
  highPriceSold: t => `200% 定价高价成交 ${t} 次`,
  pulls: t => `抽赏 ${t} 次`,
  distinctCopies: t => `架上持有 ${t} 款不同桌游实体`,
  distinctCollections: t => `图鉴收藏 ${t} 款（卖光也算）`,
};

/** 条件修饰文案（挑战卡片展示） */
function modsText(def: ChallengeDef): string[] {
  const m = def.mods;
  const out: string[] = [];
  if (m.noJobIncome) out.push('🚫 无工作收入（在线+离线均不发薪）');
  if (m.xyRefreshMult) out.push(`某鱼刷新间隔 ×${m.xyRefreshMult}`);
  if (m.xyCountMult) out.push(`某鱼到货件数 ×${m.xyCountMult}`);
  if (m.expMult) out.push(`六维经验 ×${m.expMult}`);
  if (m.fatigueIncMult) out.push(`疲劳增长 ×${m.fatigueIncMult}`);
  if (m.gachaPriceMult) out.push(`某赏价格 ×${m.gachaPriceMult}`);
  if (m.noPlay) out.push('🚫 禁止游玩桌游（补偿起步资金）');
  if (m.maxDistinctCopies) out.push(`收藏架最多 ${m.maxDistinctCopies} 款不同桌游（卖旧买新）`);
  if (m.startMoneyBonus) out.push(`开局立得资金 +¥${m.startMoneyBonus}`);
  if (m.sellChanceMult) out.push(`某鱼成交率 ×${m.sellChanceMult}`);
  return out;
}

const doneSet = computed(() => new Set(store.s.prestige.challengeDone));

function isDone(id: string): boolean {
  return doneSet.value.has(id);
}

/** 前置未满足的提示文案 */
function requiresText(def: ChallengeDef): string {
  const missing = (def.requires ?? []).filter(r => !doneSet.value.has(r));
  if (!missing.length) return '';
  const names = missing.map(r => CHALLENGES.find(c => c.id === r)?.name ?? r);
  return `🔒 需先完成：${names.join('、')}`;
}

function progressPct(def: ChallengeDef): number {
  return Math.min(100, Math.round((store.s.challenge.progress / def.goal.target) * 1000) / 10);
}

// ---------- 挑战商店 ----------

const SHOP_LINES: ChallengeShopLine[] = ['collect', 'design'];
const shopByLine = (l: ChallengeShopLine) => CHALLENGE_SHOP.filter(p => p.line === l);

function shopLv(id: string): number {
  return challengeShopLevel(store.s, id);
}

function shopCost(id: string): number {
  return challengeShopCost(challengeShopDefById(id), shopLv(id));
}

function shopPrereqText(id: string): string {
  const def = challengeShopDefById(id);
  if (!def.after || challengeShopPrereqMet(store.s, def)) return '';
  return `🔒 需先购买「${challengeShopDefById(def.after).name}」1 级`;
}

const activeGoalText = computed(() => {
  const id = store.s.challenge.active;
  if (!id) return '';
  const def = CHALLENGES.find(c => c.id === id);
  return def ? GOAL_TEXT[def.goal.type](def.goal.target) : '';
});
</script>

<template>
  <div>
    <h2>🎯 挑战场景</h2>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span>🪙 挑战币：<b class="price" style="font-size:18px">{{ store.s.prestige.coins }}</b></span>
        <span class="mut">已完成 {{ store.s.prestige.challengeDone.length }}/{{ CHALLENGES.length }} 个挑战</span>
        <span v-if="store.s.challenge.active" style="margin-left:auto;font-size:13px">
          进行中：<b>{{ CHALLENGES.find(c => c.id === store.s.challenge.active)?.name }}</b>
          <span class="mut">（{{ activeGoalText }}）</span>
        </span>
      </div>
      <div class="mut" style="margin-top:6px;font-size:12px">
        挑战在<b>转生时选择</b>、新周目开局即生效，条件修饰持续整周目（在线与离线一致），达成目标获得挑战币（每挑战一次性，跨周目保留）。
        本周目只能陪跑一个挑战，不可放弃；已完成挑战不可再选。挑战币在下方商店兑换全局加成（收藏线即时生效，设计线供后续版本）。
        挑战完成后修饰即释放，可正常游玩刷精通至自行转生。
      </div>
    </div>

    <div v-for="n in LAYERS" :key="n" class="panel" style="margin-bottom:12px">
      <h3 style="margin:0 0 8px">第 {{ n }} 层 <small class="mut">{{ n === 1 ? '开局即可选择' : '需完成前置挑战' }}</small></h3>
      <div class="grid">
        <div
          v-for="c in challengesByLayer(n)"
          :key="c.id"
          class="card"
          style="border-top:3px solid var(--gold);padding:10px"
          :style="isDone(c.id) ? { borderColor: 'var(--green)' } : {}"
        >
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>{{ isDone(c.id) ? '✓ ' : '' }}{{ c.name }}</b>
            <span class="price" style="font-size:13px">🪙 {{ c.reward }}</span>
          </div>
          <div class="tagline" style="margin:4px 0">{{ c.desc }}</div>
          <div class="mut" style="font-size:11px">
            <div v-for="t in modsText(c)" :key="t">⚡ {{ t }}</div>
            <div>🎖 目标：{{ GOAL_TEXT[c.goal.type](c.goal.target) }}</div>
          </div>

          <!-- 进行中：进度条（陪跑到完成，不可放弃） -->
          <template v-if="store.s.challenge.active === c.id">
            <div style="margin-top:8px;font-size:12px">
              进度：<b>{{ Math.min(store.s.challenge.progress, c.goal.target) }}</b> / {{ c.goal.target }}
              <span class="mut">（{{ progressPct(c) }}%）</span>
            </div>
            <div class="bar" style="margin-top:4px;height:8px">
              <i :style="{ width: progressPct(c) + '%' }"></i>
            </div>
            <div style="margin-top:6px">
              <span class="ok" style="font-size:12px">挑战进行中 · 陪跑到完成（转生时可另选新的挑战）</span>
            </div>
          </template>

          <!-- 已完成 -->
          <div v-else-if="isDone(c.id)" style="margin-top:6px" class="ok">
            <span style="font-size:12px">已完成 · 奖励已领取（一次性）</span>
          </div>

          <!-- 未解锁 -->
          <div v-else-if="!challengeAvailable(store.s, c.id)" style="margin-top:6px" class="mut">
            <span style="font-size:12px">{{ requiresText(c) }}</span>
          </div>

          <!-- 已解锁未完成：仅展示，转生时选择 -->
          <div v-else style="margin-top:6px" class="mut">
            <span style="font-size:12px">📋 已解锁 · 转生时可选择（本周目不可开启）</span>
          </div>
        </div>
      </div>
    </div>

    <div v-for="l in SHOP_LINES" :key="l" class="panel" style="margin-bottom:12px">
      <h3 style="margin:0 0 8px">{{ CHALLENGE_SHOP_LINE_NAME[l] }} <small class="mut">挑战币兑换，永久生效</small></h3>
      <div class="grid">
        <div
          v-for="p in shopByLine(l)"
          :key="p.id"
          class="card"
          style="border-top:3px solid var(--gold);padding:10px"
          :style="shopPrereqText(p.id) ? { opacity: 0.55 } : {}"
        >
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b>{{ p.name }}</b>
            <span class="mut" style="font-size:11px">{{ shopLv(p.id) }}/{{ p.max }}</span>
          </div>
          <div class="tagline" style="margin:4px 0">{{ p.desc }}</div>
          <div v-if="shopPrereqText(p.id)" class="mut" style="font-size:11px">{{ shopPrereqText(p.id) }}</div>
          <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
            <span v-if="shopLv(p.id) >= p.max" class="ok" style="font-size:12px">已满级</span>
            <template v-else>
              <span class="price" style="font-size:13px">🪙 {{ shopCost(p.id) }}</span>
              <button
                class="primary"
                :disabled="!!shopPrereqText(p.id) || store.s.prestige.coins < shopCost(p.id)"
                @click="store.buyChallengeShop(p.id)"
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
