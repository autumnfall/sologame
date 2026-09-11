<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  GACHA_PITY,
  GACHA_PRICE,
  HI_TICKET_SLEEVES,
  ROTATION_PRICE,
  isFeatureUnlocked,
  rotatingPool,
  rotatingThemeText,
} from '../../../core';
import { useGameStore } from '../../stores/game';

const store = useGameStore();

const sub = ref<'perm' | 'rot'>('perm');

const RAR_COLOR: Record<string, string> = {
  N: 'var(--N)',
  R: 'var(--R)',
  SR: 'var(--SR)',
  SSR: 'var(--SSR)',
};

// ---------- 兑换高级券 ----------
const maxExchange = computed(() =>
  Math.min(store.s.tickets, Math.floor(store.s.sleeves / HI_TICKET_SLEEVES)),
);
const exN = ref(1);
const exValid = computed(() => Number.isInteger(exN.value) && exN.value >= 1 && exN.value <= maxExchange.value);

const tenUnlocked = computed(() => isFeatureUnlocked(store.s, 'tenPull'));
</script>

<template>
  <div>
    <div class="subtabs">
      <button :class="{ active: sub === 'perm' }" @click="sub = 'perm'">🎁 常驻池</button>
      <button :class="{ active: sub === 'rot' }" @click="sub = 'rot'">🌀 轮换池</button>
    </div>

    <!-- ========== 常驻池 ========== -->
    <div v-if="sub === 'perm'" class="gacha-banner">
      <div style="font-size:18px;font-weight:800;color:var(--gold)">🎁 某赏 · 常驻一番抽</div>
      <div class="mut" style="margin:6px 0">牌套 30%（4包）/ 15%（10包）/ 5%（20包）· 桌游 N30 / R15 / SR4 / SSR1 · 50 抽保底 SR 及以上</div>
      <div>SR+ 保底进度：<b class="warn">{{ store.s.pity }} / {{ GACHA_PITY }}</b></div>
      <div style="margin-top:10px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="primary" @click="store.pullGacha('perm', 'money')">单抽（¥{{ GACHA_PRICE }}）</button>
        <button class="primary" :disabled="store.s.tickets < 1" @click="store.pullGacha('perm', 'ticket')">
          用抽赏券 ×1 抽（🎫{{ store.s.tickets }}）
        </button>
        <template v-if="tenUnlocked">
          <button :disabled="store.s.money < GACHA_PRICE * 10" @click="store.pullGachaTen('perm', 'money')">十连（¥{{ GACHA_PRICE * 10 }}）</button>
          <button :disabled="store.s.tickets < 10" @click="store.pullGachaTen('perm', 'ticket')">十连（🎫10）</button>
        </template>
      </div>
      <small>不受某宝级别解锁限制。桌游结果均为全新实体，重复款直接获得新实体（收藏级进度保留，可挂某鱼出售）；抽出 SR/SSR 时保底进度归零。</small>
    </div>

    <!-- ========== 轮换池 ========== -->
    <div v-else class="gacha-banner">
      <div style="font-size:18px;font-weight:800;color:var(--gold)">
        {{ rotatingThemeText(store.s.rotTheme) }}
        <small class="mut" style="font-weight:400">· 下次轮换 {{ store.rotCd }}</small>
      </div>
      <div class="mut" style="margin:6px 0">本池仅出「{{ store.s.rotTheme ?? '—' }}」主题的桌游 · 与常驻池同一奖池表 · 50 抽保底 SR 及以上（与常驻池独立计数）</div>
      <div>SR+ 保底进度：<b class="warn">{{ store.s.pityRot }} / {{ GACHA_PITY }}</b></div>
      <div v-if="store.s.rotTheme" class="mut" style="margin-top:8px;line-height:2">
        池内桌游：{{ rotatingPool(store.s.rotTheme).map(g => `${g.icon}${g.name}`).join('　') }}
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button
          class="primary"
          :disabled="!store.s.rotTheme"
          @click="store.pullGacha('rot', 'money')"
        >
          单抽（¥{{ ROTATION_PRICE }}）
        </button>
        <button
          class="primary"
          :disabled="!store.s.rotTheme || store.s.hiTickets < 1"
          @click="store.pullGacha('rot', 'hiTicket')"
        >
          用高级券 ×1 抽（🎟️{{ store.s.hiTickets }}）
        </button>
        <template v-if="tenUnlocked && store.s.rotTheme">
          <button :disabled="store.s.money < ROTATION_PRICE * 10" @click="store.pullGachaTen('rot', 'money')">十连（¥{{ ROTATION_PRICE * 10 }}）</button>
          <button :disabled="store.s.hiTickets < 10" @click="store.pullGachaTen('rot', 'hiTicket')">十连（🎟️10）</button>
        </template>
      </div>
      <small>轮换池每 10 分钟换一个主题属性，仅能用金钱或高级券抽取；重复同样直接获得新实体。</small>
    </div>

    <!-- ========== 兑换高级券 ========== -->
    <div class="panel" style="margin-top:12px">
      <h4 style="margin:0 0 6px">🎟️ 兑换高级券</h4>
      <div class="mut" style="margin-bottom:8px">
        1 张普通券 + {{ HI_TICKET_SLEEVES }} 张牌套 = 1 张高级券（当前可兑 <b>{{ maxExchange }}</b> 张）
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <label>
          数量：
          <input
            v-model.number="exN"
            type="number"
            min="1"
            :max="Math.max(1, maxExchange)"
            style="width:70px;margin-left:4px"
          />
        </label>
        <span class="mut">
          消耗：🎫×{{ exValid ? exN : 0 }} + 🎴×{{ exValid ? exN * HI_TICKET_SLEEVES : 0 }}
        </span>
        <button class="primary" :disabled="!exValid" @click="store.exchangeHi(exN)">确认兑换</button>
      </div>
    </div>

    <div class="logbox" style="height:120px">
      <div v-for="(e, i) in store.gachaLog" :key="i" :class="e.cls">
        [{{ e.rar }}]
        <template v-if="e.dup">重复 {{ e.rar }}《{{ e.name }}》{{ e.text }}</template>
        <template v-else><b :style="{ color: RAR_COLOR[e.rar] }">{{ e.rar }}</b>《{{ e.name }}》{{ e.text }}</template>
      </div>
    </div>
  </div>
</template>
