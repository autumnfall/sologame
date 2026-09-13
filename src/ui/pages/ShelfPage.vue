<script setup lang="ts">
import { computed, reactive } from 'vue';
import {
  DURABILITY,
  GAMES,
  canStore,
  conditionText,
  copiesOf,
  gainText,
  gameById,
  globalBonus,
  isFeatureUnlocked,
  isMastered,
  kindCount,
  masteryText,
  storageCost,
} from '../../core';
import { useGameStore } from '../stores/game';
import FilterBar from '../components/FilterBar.vue';
import GameCard from '../components/GameCard.vue';

const store = useGameStore();

/** 每种桌游的实体每页展示数，超出分页 */
const COPIES_PER_PAGE = 5;

const shelfCount = computed(
  () => `${kindCount(store.s)} 种 / ${GAMES.length} · 全局加成 +${(globalBonus(store.s) * 100).toFixed(1)}%`,
);

const ownedIds = computed(() => {
  const list = Object.keys(store.s.collections).filter(id => {
    const c = store.s.collections[id];
    if (!c.firstOpened) return false;
    const g = gameById(id);
    if (store.shelfFilter && !g.attrs.includes(store.shelfFilter)) return false;
    if (store.shelfRarity && g.rarity !== store.shelfRarity) return false;
    if (store.shelfMasteredOnly && !isMastered(store.s, id)) return false;
    if (store.shelfOwnedOnly && copiesOf(store.s, id).length === 0) return false;
    return true;
  });
  if (store.shelfSort === 'copiesDesc') {
    // 实体数量降序（可用实体数，同数量按价值降序兜底）
    list.sort((a, b) => copiesOf(store.s, b).length - copiesOf(store.s, a).length
      || gameById(b).marketPrice - gameById(a).marketPrice);
  } else if (store.shelfSort !== 'default') {
    const dir = store.shelfSort === 'valueAsc' ? 1 : -1;
    list.sort((a, b) => dir * (gameById(a).marketPrice - gameById(b).marketPrice));
  }
  return list;
});

/** 每种桌游实体的分页号（id -> 页码，从 0 起） */
const copyPage = reactive<Record<string, number>>({});

function pageOf(id: string): number {
  return copyPage[id] ?? 0;
}

/** 当前页展示的实体（最多 COPIES_PER_PAGE 个） */
function pageCopies(id: string) {
  const all = copiesOf(store.s, id);
  const pages = Math.max(1, Math.ceil(all.length / COPIES_PER_PAGE));
  const page = Math.min(pageOf(id), pages - 1);
  return { list: all.slice(page * COPIES_PER_PAGE, (page + 1) * COPIES_PER_PAGE), page, pages };
}

function turnPage(id: string, delta: number) {
  copyPage[id] = Math.max(0, pageOf(id) + delta);
}

/** 一键套牌套（成就 15 个解锁）：有可套实体时可用 */
const sleeveAllUnlocked = computed(() => isFeatureUnlocked(store.s, 'sleeveAll'));
const sleeveAllable = computed(() =>
  store.s.copies.some(c => {
    if (c.sleeved || store.s.listings.some(l => l.copyUid === c.uid)) return false;
    const cards = gameById(c.gameId).cards;
    return !!cards && cards > 0;
  }),
);

/** 某鱼快速上架（成就 30 个解锁） */
const quickListUnlocked = computed(() => isFeatureUnlocked(store.s, 'quickList'));

/** 收藏架「某鱼上架」：快速上架开启时直接按行情价 100% 上架，否则跳转某鱼出售区 */
function sellCopy(c: { uid: number }) {
  if (store.s.settings.quickList) store.listForSale(c.uid, 1.0);
  else store.gotoSell(c.uid);
}

/** 实体序号：①②③…（超过 10 用 (11) 兜底） */
function circled(i: number): string {
  return i < 10 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`;
}

function durText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
</script>

<template>
  <div>
    <h2>收藏架 <small>{{ shelfCount }}</small></h2>
    <FilterBar
      v-model="store.shelfFilter"
      v-model:mastered-only="store.shelfMasteredOnly"
      v-model:owned-only="store.shelfOwnedOnly"
      v-model:rarity="store.shelfRarity"
      v-model:sort="store.shelfSort"
    />
    <div v-if="sleeveAllUnlocked || quickListUnlocked" style="margin:0 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button v-if="sleeveAllUnlocked" :disabled="!sleeveAllable" @click="store.sleeveAllCopies()">🎴 一键套牌套</button>
      <button
        v-if="quickListUnlocked"
        :class="{ primary: store.s.settings.quickList }"
        @click="store.toggleQuickList()"
      >
        {{ store.s.settings.quickList ? '✓ ' : '' }}🐟 某鱼快速上架
      </button>
      <small v-if="store.s.settings.quickList" class="mut">开启中：点「某鱼上架」直接按行情价 100% 上架，不再跳转</small>
    </div>
    <div v-if="!ownedIds.length" class="mut">收藏架空空的。</div>
    <div v-else class="grid">
      <GameCard v-for="id in ownedIds" :key="id" :game="gameById(id)">
        <div>{{ masteryText(store.s, gameById(id)) }}</div>
        <div class="tagline">每局 {{ gainText(gameById(id)) }}</div>
        <div v-if="gameById(id).affix" class="tagline" style="color:#d9a5f5">✦ {{ gameById(id).affix?.desc }}</div>
        <div class="bar" title="疲劳（变红 = 玩腻了）">
          <i
            :style="{
              width: Math.min(100, Math.round(store.s.collections[id].fatigue * 10)) + '%',
              background: store.s.collections[id].fatigue >= 7 ? 'var(--red)' : 'var(--green)',
            }"
          ></i>
        </div>
        <!-- 实体列表：成色 / 耐久 / 牌套 / 收纳 / 某鱼上架（每页最多 5 个，超出分页） -->
        <div v-if="copiesOf(store.s, id).length" style="margin-top:6px">
          <div
            v-for="(c, i) in pageCopies(id).list"
            :key="c.uid"
            class="panel"
            style="padding:8px;margin-bottom:6px"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <span>
                <b>实体{{ circled(pageCopies(id).page * COPIES_PER_PAGE + i) }}</b>{{ c.locked ? ' 🔒已锁定' : '' }} · {{ conditionText(c.durability, gameById(id).rarity) }}
                {{ c.sleeved ? '🎴已套(×0.85)' : (gameById(id).cards ? `🎴未套（需 ${gameById(id).cards} 张）` : '🎴无卡牌') }}
                {{ canStore(gameById(id)) ? (c.stored ? '📦已收纳(Setup×0.5·磨损×0.75)' : '📦未收纳') : '' }}
              </span>
              <span style="display:flex;gap:4px;flex-wrap:wrap">
                <button
                  v-if="gameById(id).cards && gameById(id).cards! > 0 && !c.sleeved"
                  :disabled="store.s.sleeves < (gameById(id).cards ?? 0)"
                  @click="store.sleeve(c.uid)"
                >
                  套牌套 {{ gameById(id).cards }}张
                </button>
                <button
                  v-if="canStore(gameById(id)) && !c.stored"
                  :disabled="store.s.money < storageCost(gameById(id))"
                  @click="store.storage(c.uid)"
                >
                  收纳 ¥{{ storageCost(gameById(id)) }}
                </button>
                <button @click="store.toggleCopyLock(c.uid)">{{ c.locked ? '🔓 解锁' : '🔒 锁定' }}</button>
                <button v-if="!c.locked" @click="sellCopy(c)">某鱼上架</button>
              </span>
            </div>
            <div class="bar" title="耐久">
              <i
                :style="{
                  width: Math.min(100, Math.round((c.durability / DURABILITY[gameById(id).rarity]) * 1000) / 10) + '%',
                  background: c.durability <= 0 ? 'var(--red)' : 'var(--green)',
                }"
              ></i>
            </div>
            <small class="mut">
              耐久 {{ durText(c.durability) }}/{{ DURABILITY[gameById(id).rarity]
              }}{{ c.durability <= 0 ? '（已磨光，收益 ×0.5）' : '' }}
            </small>
          </div>
          <div v-if="pageCopies(id).pages > 1" style="display:flex;gap:6px;align-items:center;justify-content:flex-end;font-size:12px">
            <button style="padding:2px 8px;font-size:12px" :disabled="pageCopies(id).page <= 0" @click="turnPage(id, -1)">‹ 上一页</button>
            <span class="mut">{{ pageCopies(id).page + 1 }} / {{ pageCopies(id).pages }} 页 · 共 {{ copiesOf(store.s, id).length }} 实体</span>
            <button style="padding:2px 8px;font-size:12px" :disabled="pageCopies(id).page >= pageCopies(id).pages - 1" @click="turnPage(id, 1)">下一页 ›</button>
          </div>
        </div>
        <div v-else class="mut" style="margin-top:6px">实体已全部售出（收藏进度保留）。</div>
      </GameCard>
    </div>
  </div>
</template>
