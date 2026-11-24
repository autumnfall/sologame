<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ATTR_EFFECT, ATTR_ICON, ATTRS, attrProgress, fmt, globalBonus } from '../../core';
import { useGameStore } from '../stores/game';
import type { TabKey } from '../stores/game';
import UiIcon from './UiIcon.vue';

const store = useGameStore();

const tabs = [
  { key: 'play', label: '游玩' },
  { key: 'work', label: '工作' },
  { key: 'shop', label: '商店' },
  { key: 'shelf', label: '收藏架' },
  { key: 'challenge', label: '挑战' },
  { key: 'design', label: '设计工坊' },
  { key: 'prestige', label: '转生' },
  { key: 'guide', label: '教程' },
  { key: 'changelog', label: '版本更新' },
] as const;
const primary = tabs.slice(0, 4);
const secondary = computed(() => tabs.slice(4).filter(t => t.key !== 'design' || store.s.designer.unlocked));
const moreOpen = ref(false);
const moreButton = ref<HTMLButtonElement | null>(null);
const moreMenu = ref<HTMLElement | null>(null);
const attrsOpen = ref(false);
const mobileSecondaryActive = computed(() => secondary.value.some(t => t.key === store.tab));

const resources = computed(() => [
  { icon: 'money', label: '资金', value: '¥' + fmt(store.s.money) },
  { icon: 'sleeves', label: '牌套', value: store.s.sleeves },
  { icon: 'ticket', label: '抽赏券', value: store.s.tickets },
  ...(store.s.hiTickets ? [{ icon: 'ticket' as const, label: '高级券', value: store.s.hiTickets }] : []),
  ...(store.s.prestige.runs ? [{ icon: 'prestige' as const, label: '阅历', value: store.s.prestige.insight }] : []),
] as const);

const attrChips = computed(() => ATTRS.map(a => {
  const p = attrProgress(store.s, a);
  return { a, lv: p.lv, cur: p.cur, need: p.need, title: ATTR_EFFECT[a] };
}));

function selectTab(tab: TabKey) {
  store.tab = tab;
  closeMore();
}

function closeMore(restoreFocus = false) {
  moreOpen.value = false;
  if (restoreFocus) moreButton.value?.focus();
}

async function toggleMore() {
  if (moreOpen.value) {
    closeMore();
    return;
  }
  moreOpen.value = true;
  await nextTick();
  moreMenu.value?.querySelector('button')?.focus();
}

watch(() => store.tab, () => {
  closeMore();
  attrsOpen.value = false;
});
</script>

<template>
  <aside class="desktop-sidebar">
    <button type="button" class="brand" @click="selectTab('play')">
      <span class="brand-mark"><UiIcon name="play" /></span>
      <span><strong>桌游收藏家</strong><small>TABLETOP COLLECTOR</small></span>
    </button>
    <nav class="sidebar-nav" aria-label="主导航">
      <div class="sidebar-group">
        <button v-for="item in primary" :key="item.key" class="nav-item" type="button"
          :aria-current="store.tab === item.key ? 'page' : undefined" @click="selectTab(item.key)">
          <UiIcon :name="item.key" />{{ item.label }}
        </button>
      </div>
      <div class="sidebar-group">
        <button v-for="item in secondary" :key="item.key" class="nav-item" type="button"
          :aria-current="store.tab === item.key ? 'page' : undefined" @click="selectTab(item.key)">
          <UiIcon :name="item.key" />{{ item.label }}
        </button>
      </div>
    </nav>
  </aside>

  <header id="topbar">
    <div class="status-inner">
      <button class="mobile-brand" type="button" aria-label="桌游收藏家，返回游玩" @click="selectTab('play')">
        <span class="brand-mark"><UiIcon name="play" /></span>
        <strong>桌游收藏家</strong>
      </button>
      <div class="run-label"><UiIcon name="prestige" />第 {{ store.s.prestige.runs + 1 }} 周目</div>
      <dl class="resource-list" aria-label="资源">
        <div v-for="resource in resources" :key="resource.label" class="resource" :class="'resource-' + resource.icon">
          <UiIcon :name="resource.icon" />
          <div><dt>{{ resource.label }}</dt><dd>{{ resource.value }}</dd></div>
        </div>
      </dl>
      <button type="button" class="attribute-toggle" :aria-expanded="attrsOpen" aria-controls="attribute-summary"
        @click="attrsOpen = !attrsOpen">
        <span>属性</span><UiIcon name="chevron" />
      </button>
    </div>

    <div id="attribute-summary" class="attribute-wrap" :class="{ 'is-open': attrsOpen }">
      <div class="attribute-inner">
        <dl class="attr-list" aria-label="属性等级">
          <div v-for="chip in attrChips" :key="chip.a" class="attr-chip" :title="chip.title">
            <dt><span aria-hidden="true">{{ ATTR_ICON[chip.a] }}</span> {{ chip.a }}</dt>
            <dd>Lv.{{ chip.lv }}</dd>
            <progress :value="chip.cur" :max="chip.need" :aria-label="chip.a + '升级进度'">{{ chip.cur }}/{{ chip.need }}</progress>
          </div>
        </dl>
        <span class="collection-bonus">图鉴经验 <b>+{{ (globalBonus(store.s) * 100).toFixed(1) }}%</b></span>
      </div>
    </div>
  </header>

  <div class="mobile-navigation" @keydown.esc.stop="closeMore(true)">
    <div v-if="moreOpen" class="mobile-menu-scrim" aria-hidden="true" @click="closeMore(true)"></div>
    <nav v-if="moreOpen" id="mobile-more" ref="moreMenu" class="mobile-more" aria-label="更多页面">
      <button v-for="item in secondary" :key="item.key" type="button" class="nav-item"
        :aria-current="store.tab === item.key ? 'page' : undefined" @click="selectTab(item.key); moreButton?.focus()">
        <UiIcon :name="item.key" />{{ item.label }}
      </button>
    </nav>
    <nav class="bottom-nav" aria-label="主导航">
      <button v-for="item in primary" :key="item.key" type="button"
        :aria-current="store.tab === item.key ? 'page' : undefined" @click="selectTab(item.key)">
        <UiIcon :name="item.key" />{{ item.label }}
      </button>
      <button ref="moreButton" type="button" :class="{ 'is-active': mobileSecondaryActive || moreOpen }"
        :aria-expanded="moreOpen" :aria-controls="moreOpen ? 'mobile-more' : undefined" @click="toggleMore">
        <UiIcon name="more" />更多
      </button>
    </nav>
  </div>
</template>
