<script setup lang="ts">
import { useGameLifecycle } from './composables/useGameLifecycle';
import { useGameStore } from './stores/game';
import TopBar from './components/TopBar.vue';
import Toast from './components/Toast.vue';
import StarterModal from './components/StarterModal.vue';
import OfflineModal from './components/OfflineModal.vue';
import PrestigeSetupModal from './components/PrestigeSetupModal.vue';
import PlayPage from './pages/PlayPage.vue';
import WorkPage from './pages/WorkPage.vue';
import ShopPage from './pages/ShopPage.vue';
import ShelfPage from './pages/ShelfPage.vue';
import ChallengePage from './pages/ChallengePage.vue';
import DesignPage from './pages/DesignPage.vue';
import PrestigePage from './pages/PrestigePage.vue';
import GuidePage from './pages/GuidePage.vue';
import ChangelogPage from './pages/ChangelogPage.vue';

const store = useGameStore();

useGameLifecycle(store);

// PWA 新版本刷新
const applyUpdate = () => {
  const f = store.pwaUpdate;
  store.pwaUpdate = null;
  f?.();
};
</script>

<template>
  <TopBar />
  <div v-if="store.saveNotice" class="panel" role="alert">{{ store.saveNotice }}</div>
  <div v-if="store.recoveryNotice" class="panel" role="status">
    {{ store.recoveryNotice }}
    <button @click="store.exportSave()">导出备份</button>
    <button @click="store.recoveryNotice = ''">知道了</button>
  </div>
  <div id="content">
    <PlayPage v-if="store.tab === 'play'" />
    <WorkPage v-else-if="store.tab === 'work'" />
    <ShopPage v-else-if="store.tab === 'shop'" />
    <ShelfPage v-else-if="store.tab === 'shelf'" />
    <ChallengePage v-else-if="store.tab === 'challenge'" />
    <DesignPage v-else-if="store.tab === 'design' && store.s.designer.unlocked" />
    <PrestigePage v-else-if="store.tab === 'prestige'" />
    <GuidePage v-else-if="store.tab === 'guide' || store.tab === 'design'" />
    <ChangelogPage v-else />
  </div>
  <StarterModal />
  <OfflineModal />
  <PrestigeSetupModal />
  <Toast />
  <div v-if="store.pwaUpdate" id="pwa-update">
    <span>🎉 发现新版本</span>
    <button class="primary" @click="applyUpdate">刷新更新</button>
  </div>
</template>
