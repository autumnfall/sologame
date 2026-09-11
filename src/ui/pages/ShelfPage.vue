<script setup lang="ts">
import { computed } from 'vue';
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
  kindCount,
  masteryText,
  storageCost,
} from '../../core';
import { useGameStore } from '../stores/game';
import FilterBar from '../components/FilterBar.vue';
import GameCard from '../components/GameCard.vue';

const store = useGameStore();

const shelfCount = computed(
  () => `${kindCount(store.s)} 种 / ${GAMES.length} · 全局加成 +${(globalBonus(store.s) * 100).toFixed(1)}%`,
);

const ownedIds = computed(() =>
  Object.keys(store.s.collections).filter(
    id =>
      store.s.collections[id].firstOpened &&
      (!store.shelfFilter || gameById(id).attrs.includes(store.shelfFilter)),
  ),
);

/** 一键套牌套（成就 15 个解锁）：有可套实体时可用 */
const sleeveAllUnlocked = computed(() => isFeatureUnlocked(store.s, 'sleeveAll'));
const sleeveAllable = computed(() =>
  store.s.copies.some(c => {
    if (c.sleeved || store.s.listings.some(l => l.copyUid === c.uid)) return false;
    const cards = gameById(c.gameId).cards;
    return !!cards && cards > 0;
  }),
);

/** 实体序号：①②③…（超过 10 用 (11) 兜底） */
function circled(i: number): string {
  return i < 10 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`;
}

function durText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function copies(id: string) {
  return copiesOf(store.s, id);
}
</script>

<template>
  <div>
    <h2>收藏架 <small>{{ shelfCount }}</small></h2>
    <FilterBar v-model="store.shelfFilter" />
    <div v-if="sleeveAllUnlocked" style="margin:0 0 10px">
      <button :disabled="!sleeveAllable" @click="store.sleeveAllCopies()">🎴 一键套牌套（逐盒扣牌套）</button>
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
        <!-- 实体列表：成色 / 耐久 / 牌套 / 收纳 / 某鱼上架 -->
        <div v-if="copies(id).length" style="margin-top:6px">
          <div
            v-for="(c, i) in copies(id)"
            :key="c.uid"
            class="panel"
            style="padding:8px;margin-bottom:6px"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
              <span>
                <b>实体{{ circled(i) }}</b> · {{ conditionText(c.durability, gameById(id).rarity) }}
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
                <button @click="store.gotoSell(c.uid)">某鱼上架</button>
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
        </div>
        <div v-else class="mut" style="margin-top:6px">实体已全部售出（收藏进度保留）。</div>
      </GameCard>
    </div>
  </div>
</template>
