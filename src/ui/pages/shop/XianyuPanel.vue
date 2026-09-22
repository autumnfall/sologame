<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  MARKET_SLOT_COSTS,
  MARKET_SLOTS_MAX,
  SELL_PRICE_MAX,
  SELL_PRICE_MIN,
  SELL_SLOT_COSTS,
  conditionText,
  copyByUid,
  copyRarity,
  copyValueOf,
  designByGameId,
  gameById,
  gainText,
  isDesignedId,
  isFeatureUnlocked,
  marketItemValue,
  sellChanceFinal,
  sellSlotsMax,
} from '../../../core';
import type { Copy } from '../../../core';
import { useGameStore } from '../../stores/game';
import GameCard from '../../components/GameCard.vue';

const store = useGameStore();

// ---------- 买 ----------
/** 相对总价值百分比（<90 划算，>130 偏贵） */
function ratioPct(it: { price: number } & Parameters<typeof marketItemValue>[0]): number {
  return Math.round((it.price / marketItemValue(it)) * 100);
}

function ratioCls(pct: number): string {
  return pct < 90 ? 'ok' : pct > 130 ? 'bad2' : '';
}

// ---------- 卖 ----------
const listedUids = computed(() => new Set(store.s.listings.map(l => l.copyUid)));
const sellable = computed(() => store.s.copies.filter(c => !listedUids.value.has(c.uid) && !c.locked));

const sellUid = ref<number | null>(store.sellPickUid);
watch(
  () => store.sellPickUid,
  v => {
    if (v != null) sellUid.value = v;
  },
);
const sellCopy = computed(() => sellable.value.find(c => c.uid === sellUid.value) ?? null);
const multPct = ref(100);
const priceMult = computed(() => multPct.value / 100);

/** 实体序号：①②③…（超过 10 用 (11) 兜底） */
function circled(i: number): string {
  return i < 10 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`;
}

function copyLabel(c: Copy): string {
  if (c.designed) {
    const d = designByGameId(store.s, c.gameId);
    return `《${d?.name ?? '自创桌游'}》 自创 · ${conditionText(c.durability, 'SSR')}`;
  }
  const g = gameById(c.gameId);
  const idx = store.s.copies.filter(x => x.gameId === c.gameId).findIndex(x => x.uid === c.uid);
  return `《${g.name}》 实体${circled(idx)} · ${conditionText(c.durability, g.rarity)} · 耐久 ${durText(c.durability)}`;
}

/** 出售候选：按游戏分组（组名排序），组内低耐久在前，磨光件标 🔧 */
const sellGroups = computed(() => {
  const map = new Map<string, Copy[]>();
  for (const c of sellable.value) {
    const arr = map.get(c.gameId) ?? [];
    arr.push(c);
    map.set(c.gameId, arr);
  }
  return [...map.entries()]
    .map(([gameId, copies]) => ({
      gameId,
      copies: [...copies].sort((a, b) => a.durability - b.durability),
    }))
    .sort((a, b) => groupName(a.gameId).localeCompare(groupName(b.gameId), 'zh'));
});

function groupName(gameId: string): string {
  return isDesignedId(gameId) ? (designByGameId(store.s, gameId)?.name ?? '自创桌游') : gameById(gameId).name;
}

function durText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function listedPrice(c: Copy, mult: number): number {
  return Math.max(10, Math.round(copyValueOf(store.s, c) * mult)); // 自创设计按出版定价取价
}

const sellPrice = computed(() => (sellCopy.value ? listedPrice(sellCopy.value, priceMult.value) : 0));
const sellOdds = computed(() =>
  sellCopy.value
    ? sellChanceFinal(store.s, priceMult.value, sellCopy.value.durability, copyRarity(sellCopy.value))
    : 0,
);

const sellCost = computed(() =>
  store.s.sellSlots >= sellSlotsMax(store.s) ? null : SELL_SLOT_COSTS[store.s.sellSlots - 1],
);
const marketCost = computed(() =>
  store.s.marketSlots >= MARKET_SLOTS_MAX ? null : MARKET_SLOT_COSTS[store.s.marketSlots - 3],
);

/** 一键上架磨光件（成就 20 个解锁） */
const listWornUnlocked = computed(() => isFeatureUnlocked(store.s, 'listWorn'));
const wornCount = computed(() =>
  store.s.copies.filter(c => c.durability <= 0 && !c.locked && !store.s.listings.some(l => l.copyUid === c.uid)).length,
);

/** 在售列表展示行（游戏名/成色、定价、预计成交率） */
const listingRows = computed(() =>
  store.s.listings.map(l => {
    const c = copyByUid(store.s, l.copyUid);
    if (!c) return { uid: l.copyUid, label: '（实体丢失）', price: l.price, odds: 0 };
    const value = copyValueOf(store.s, c);
    return {
      uid: l.copyUid,
      label: copyLabel(c),
      price: l.price,
      odds: sellChanceFinal(store.s, l.price / value, c.durability, copyRarity(c)),
    };
  }),
);
</script>

<template>
  <div>
    <!-- ========== 买 ========== -->
    <h4 style="margin:0 0 8px">🛍️ 淘货</h4>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
      <button @click="store.refreshXy(true)">🔄 刷新货源（¥20）</button>
      <small class="mut">
        每批 {{ store.s.marketSlots }} 件普通货源 + <b>1 件一口价盲买</b>（只看名字，成色/牌套/收纳未知，价格 = 总价值 80%~120%）。普通货源均为带成色的实体（3~10成新，可能带牌套/收纳），价格为总价值 50%~200%；可跨级别刷出高级桌游，偶见隐藏款！每 5 分钟自动到货（<b>{{ store.xyCd }}</b>）
      </small>
    </div>
    <div v-if="!store.s.xianyuBuys.length" class="mut">货架空空，点上方按钮刷新一批货源。</div>
    <div v-else class="grid">
      <!-- 一口价盲买：只看名字，隐藏成色/牌套/收纳 -->
      <GameCard v-for="(it, i) in store.s.xianyuBuys.filter(x => x.blind)" :key="'blind' + it.gameId + i" :game="gameById(it.gameId)" own-badge>
        <span class="oop-tag">🔒 一口价 · 成色未知</span>
        <div class="tagline">只看名字不看货：成色、牌套、收纳全隐藏</div>
        <div class="tagline">价格为总价值 80%~120%，每局 {{ gainText(gameById(it.gameId)) }}</div>
        <template #actions>
          <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
            <span class="price">¥{{ it.price }}</span>
            <button class="primary" :disabled="store.s.money < it.price" @click="store.buyXy(store.s.xianyuBuys.indexOf(it))">盲狙</button>
          </div>
        </template>
      </GameCard>
      <GameCard v-for="(it, i) in store.s.xianyuBuys.filter(x => !x.blind)" :key="it.gameId + i" :game="gameById(it.gameId)" own-badge>
        <span v-if="gameById(it.gameId).hidden" class="oop-tag">隐藏款 · {{ gameById(it.gameId).affix?.desc }}</span>
        <div class="tagline">
          {{ conditionText(it.durability, gameById(it.gameId).rarity) }}{{ it.sleeved ? ' · 🎴已套牌套' : ''
          }}{{ it.stored ? ' · 📦已收纳' : '' }}
        </div>
        <div class="tagline">
          总价值 ¥{{ marketItemValue(it) }}（本件 {{ ratioPct(it) }}%）· 每局 {{ gainText(gameById(it.gameId)) }}
        </div>
        <template #actions>
          <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
            <span class="price" :class="ratioCls(ratioPct(it))">¥{{ it.price }}</span>
            <button class="primary" :disabled="store.s.money < it.price" @click="store.buyXy(store.s.xianyuBuys.indexOf(it))">拿下</button>
          </div>
        </template>
      </GameCard>
    </div>

    <!-- ========== 卖 ========== -->
    <h4 style="margin:18px 0 8px">📤 出售上架（{{ store.s.listings.length }}/{{ store.s.sellSlots }} 槽位）</h4>
    <div class="panel">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <label>
          选择实体：
          <select v-model.number="sellUid" style="margin-left:4px;max-width:280px">
            <option :value="null" disabled>— 选择要上架的实体 —</option>
            <optgroup v-for="grp in sellGroups" :key="grp.gameId" :label="`《${groupName(grp.gameId)}》`">
              <option v-for="c in grp.copies" :key="c.uid" :value="c.uid">
                {{ (c.durability <= 0 ? '🔧 ' : '') + copyLabel(c) }}
              </option>
            </optgroup>
          </select>
        </label>
        <label>
          定价倍率：
          <input
            v-model.number="multPct"
            type="range"
            :min="SELL_PRICE_MIN * 100"
            :max="SELL_PRICE_MAX * 100"
            step="5"
            style="vertical-align:middle"
          />
          <b>{{ multPct }}%</b>
        </label>
        <span v-if="sellCopy" class="mut">
          → 定价 <b class="price">¥{{ sellPrice }}</b> · 预计成交率 <b>{{ Math.round(sellOdds * 100) }}%</b>
        </span>
        <button
          class="primary"
          :disabled="!sellCopy || store.s.listings.length >= store.s.sellSlots"
          @click="store.listForSale(sellCopy!.uid, priceMult)"
        >
          上架
        </button>
        <button
          v-if="listWornUnlocked"
          :disabled="wornCount === 0 || store.s.listings.length >= store.s.sellSlots"
          :title="`按行情价 100% 上架所有磨光实体（当前 ${wornCount} 件）`"
          @click="store.listWorn()"
        >
          📦 一键上架磨光件（{{ wornCount }}）
        </button>
      </div>
      <div v-if="listingRows.length" style="display:flex;flex-direction:column;gap:6px">
        <div
          v-for="row in listingRows"
          :key="row.uid"
          style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:6px"
        >
          <span>{{ row.label }}</span>
          <span class="price">¥{{ row.price }}</span>
          <small class="mut">预计成交率 {{ Math.round(row.odds * 100) }}%</small>
          <button style="margin-left:auto" @click="store.unlistForSale(row.uid)">下架</button>
        </div>
      </div>
      <div v-else class="mut">暂无在售。上架后每 5 分钟按「定价 × 成色」判定成交，收取 5% 手续费。</div>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button :disabled="sellCost === null || store.s.money < (sellCost ?? 0)" @click="store.expandSell()">
          扩充出售槽位（{{ sellCost === null ? '已满' : `¥${sellCost}` }}）
        </button>
        <button :disabled="marketCost === null || store.s.money < (marketCost ?? 0)" @click="store.expandMarket()">
          扩充市场货架（{{ marketCost === null ? '已满' : `¥${marketCost}` }}）
        </button>
      </div>
    </div>
  </div>
</template>
