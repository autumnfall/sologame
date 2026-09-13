import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import { useGameStore } from './stores/game';
import './style.css';

// PWA：prompt 模式，新版本就绪后由底部更新条手动刷新（不打断进行中的游玩）
const updateSW = registerSW({
  onNeedRefresh() {
    useGameStore().pwaUpdate = () => updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    // 定时询问是否有新版本（单位：毫秒）
    setInterval(() => registration.update(), 30 * 60 * 1000);
  },
});

createApp(App).use(createPinia()).mount('#app');
