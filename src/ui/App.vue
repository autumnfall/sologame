<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useGameStore } from './stores/game';
import TopBar from './components/TopBar.vue';
import Toast from './components/Toast.vue';
import StarterModal from './components/StarterModal.vue';
import OfflineModal from './components/OfflineModal.vue';
import PlayPage from './pages/PlayPage.vue';
import WorkPage from './pages/WorkPage.vue';
import ShopPage from './pages/ShopPage.vue';
import ShelfPage from './pages/ShelfPage.vue';
import PrestigePage from './pages/PrestigePage.vue';
import GuidePage from './pages/GuidePage.vue';

const store = useGameStore();

let rafId = 0;
let saveTimer = 0;

function loop(now: number) {
  store.advanceFrame(now);
  rafId = requestAnimationFrame(loop);
}

const onUnload = () => store.saveGame();

// 状态栏+标签页吸顶高度写入 --topbar-h，供 #play-panel 的 sticky top 避让
function syncTopbarH() {
  const el = document.getElementById('topbar');
  if (el) document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
}
const onResize = () => syncTopbarH();

// 时机条：空格判定（对应原型 runTimingBar 的 keydown 监听）
const onKey = (e: KeyboardEvent) => {
  const t = store.session?.timing;
  if (e.code === 'Space' && t && !t.judged) {
    e.preventDefault();
    store.judgeTiming();
  }
};

onMounted(() => {
  store.boot();
  syncTopbarH();
  rafId = requestAnimationFrame(loop);
  // 每 5 秒定时存档（正式版替代原型的 20% 概率随机存档）
  saveTimer = window.setInterval(() => store.saveGame(), 5000);
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  clearInterval(saveTimer);
  window.removeEventListener('beforeunload', onUnload);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <TopBar />
  <div id="content">
    <PlayPage v-if="store.tab === 'play'" />
    <WorkPage v-else-if="store.tab === 'work'" />
    <ShopPage v-else-if="store.tab === 'shop'" />
    <ShelfPage v-else-if="store.tab === 'shelf'" />
    <PrestigePage v-else-if="store.tab === 'prestige'" />
    <GuidePage v-else />
  </div>
  <StarterModal />
  <OfflineModal />
  <Toast />
</template>
