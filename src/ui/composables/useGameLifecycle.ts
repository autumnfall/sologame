import { onMounted, onUnmounted } from 'vue';
import type { useGameStore } from '../stores/game';

/** 页面生命周期与浏览器事件集中管理，离屏时停止帧推进和自动保存。 */
export function useGameLifecycle(store: ReturnType<typeof useGameStore>) {
  let rafId = 0;
  let saveTimer = 0;
  let headerObserver: ResizeObserver | undefined;
  function loop(now: number) {
    store.advanceFrame(now);
    rafId = requestAnimationFrame(loop);
  }
  const onUnload = () => store.saveGame();
  const onVis = () => {
    if (document.hidden) store.suspendGame();
    else store.resumeGame();
  };
  const onKey = (e: KeyboardEvent) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [contenteditable]')) return;
    if (e.code === 'Space' && store.session?.timing && !e.repeat && !document.querySelector('dialog:modal')) {
      e.preventDefault();
      store.judgeTiming();
    }
  };
  const syncTopbarH = () => {
    const el = document.getElementById('topbar');
    if (el) document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
  };

  onMounted(() => {
    store.boot();
    onVis();
    syncTopbarH();
    const topbar = document.getElementById('topbar');
    if (topbar) {
      headerObserver = new ResizeObserver(syncTopbarH);
      headerObserver.observe(topbar);
    }
    rafId = requestAnimationFrame(loop);
    saveTimer = window.setInterval(() => store.saveGame(), 5000);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', store.suspendGame);
    window.addEventListener('pageshow', onVis);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
  });
  onUnmounted(() => {
    cancelAnimationFrame(rafId);
    clearInterval(saveTimer);
    store.clearSession();
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('pagehide', store.suspendGame);
    window.removeEventListener('pageshow', onVis);
    window.removeEventListener('keydown', onKey);
    headerObserver?.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  });
}
