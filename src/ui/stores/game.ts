import { defineStore } from 'pinia';
import {
  ATTR_ICON,
  XY_REFRESH_MS,
  accumulateOffline,
  applySleeve,
  applyStorage,
  buyTaobao,
  buyXianyu,
  claimOffline,
  defaultState,
  fmt,
  gameById,
  gachaDraw,
  goldZoneWidth,
  initTaobaoStock,
  load,
  jobById,
  pickStarter as corePickStarter,
  playDuration,
  quitJob,
  refreshXianyu,
  ruleDuration,
  save,
  settleRound,
  setupDuration,
  takeJob,
  tickSecond,
  tickXianyu,
} from '../../core';
import type { Attr, GameState, Rarity } from '../../core';

export type TabKey = 'play' | 'work' | 'shop' | 'shelf' | 'guide';
export type ShopTabKey = 'taobao' | 'xianyu' | 'gacha';

/** 一局中的一个阶段（读规则/Setup/游玩/结算） */
export interface PlayPhase {
  key: string;
  name: string;
  /** 游戏内分钟数（≤0 表示跳过） */
  total: number;
  done: boolean;
  /** 时机条判定结果：null = 未判定 */
  hit: boolean | null;
  /** 已推进的毫秒数 */
  t: number;
  /** 当前进度 0~100（store 计算，组件只展示） */
  pct: number;
  timingStarted: boolean;
}

/** 时机条运行时状态 */
export interface TimingState {
  phaseIdx: number;
  t0: number;
  durMs: number;
  /** 金区左缘 %（15%~65% 随机） */
  zl: number;
  /** 金区宽度 %（goldZoneWidth） */
  zw: number;
  /** 光标当前位置 %（往返摆动） */
  pos: number;
  judged: boolean;
}

export interface PlaySession {
  gameId: string;
  nextId: string | null;
  stopAfter: boolean;
  round: number;
  phases: PlayPhase[];
  idx: number;
  settled: boolean;
  timing: TimingState | null;
  restartTimer: number | null;
}

export interface LogLine {
  text: string;
  cls: string;
}

export interface GachaEntry {
  rar: Rarity;
  dup: boolean;
  name: string;
  text: string;
  cls: string;
}

let toastTimer: number | undefined;

/** 光标往返位置公式：elapsed%2<1 时 (elapsed%1)*100，否则 (1-elapsed%1)*100 */
function cursorPos(el: number): number {
  return el % 2 < 1 ? (el % 1) * 100 : (1 - (el % 1)) * 100;
}

export const useGameStore = defineStore('game', {
  state: () => ({
    s: defaultState() as GameState,
    tab: 'play' as TabKey,
    shopTab: 'taobao' as ShopTabKey,
    playFilter: null as Attr | null,
    shelfFilter: null as Attr | null,
    session: null as PlaySession | null,
    playLog: [] as LogLine[],
    gachaLog: [] as GachaEntry[],
    showStarter: false,
    toastMsg: '',
    toastOn: false,
    nowMs: Date.now(),
    lastTick: 0,
    secAcc: 0,
  }),
  getters: {
    /** 离线收益已累积分钟数（展示用） */
    bankMinutes(state): string {
      return (state.s.offlineBank.t / 60000).toFixed(0);
    },
    /** 某鱼到货倒计时 mm:ss */
    xyCd(state): string {
      const r = Math.max(0, state.s.xyNext - state.nowMs);
      return `${Math.floor(r / 60000)}:${String(Math.floor(r / 1000) % 60).padStart(2, '0')}`;
    },
  },
  actions: {
    toast(msg: string) {
      this.toastMsg = msg;
      this.toastOn = true;
      if (toastTimer !== undefined) clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        this.toastOn = false;
      }, 2200);
    },

    saveGame() {
      save(this.s);
    },

    /** 启动流程（对应原型 boot IIFE） */
    boot() {
      this.s = load() ?? defaultState();
      initTaobaoStock(this.s);
      if (!this.s.started) {
        refreshXianyu(this.s, false);
        save(this.s);
        this.showStarter = true;
      } else {
        if (!this.s.xyNext) this.s.xyNext = Date.now() + XY_REFRESH_MS;
        if (!this.s.xianyu.length) refreshXianyu(this.s, false);
        const away = Date.now() - this.s.lastSeen;
        if (away > 60000) accumulateOffline(this.s, away);
        if (away > 60000 && this.s.offlineBank.money > 0) {
          this.toast(`欢迎回来！离线收益已累积 ¥${fmt(this.s.offlineBank.money)}`);
        }
      }
      this.lastTick = 0;
      this.secAcc = 0;
    },

    /** 每帧推进（rAF 主循环）：play session + 每秒 tick */
    advanceFrame(now: number) {
      const dt = this.lastTick ? now - this.lastTick : 0;
      this.lastTick = now;
      const ps = this.session;
      if (ps && !ps.settled) this.advancePlay(ps, dt);
      this.secAcc += dt;
      if (this.secAcc >= 1000) {
        this.secAcc -= 1000;
        this.nowMs = Date.now();
        this.tickOnce();
      }
    },

    /** 每秒一次：工作结算 + 某鱼自动到货 */
    tickOnce() {
      const r = tickSecond(this.s);
      if (r.ticketDrop) this.toast('🎫 工作中捡到一张某赏抽赏券！');
      if (r.streamEvent) this.toast('📺 直播事件：' + r.streamEvent);
      if (tickXianyu(this.s)) this.toast('🔄 某鱼自动到货一批新货源');
    },

    logPlay(text: string, cls = '') {
      this.playLog.push({ text, cls });
      if (this.playLog.length > 60) this.playLog.splice(0, this.playLog.length - 60);
    },

    // ---------- 游玩会话 ----------

    startPlay(id: string) {
      if (this.session) return;
      this.playLog = [];
      this.session = {
        gameId: id,
        nextId: null,
        stopAfter: false,
        round: 0,
        phases: [],
        idx: 0,
        settled: false,
        timing: null,
        restartTimer: null,
      };
      this.beginRound(id);
    },

    /** 开始一轮：重新计算各段时长（牌套/收纳/熟练度减速即时生效） */
    beginRound(id: string) {
      const ps = this.session;
      if (!ps) return;
      const g = gameById(id);
      if (ps.restartTimer !== null) {
        clearTimeout(ps.restartTimer);
        ps.restartTimer = null;
      }
      ps.gameId = id;
      ps.nextId = null;
      ps.round++;
      ps.phases = [
        { key: 'rules', name: '读规则', total: ruleDuration(this.s, g), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
        { key: 'setup', name: 'Setup', total: setupDuration(this.s, g), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
        { key: 'play', name: '游玩', total: playDuration(this.s, g), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
        { key: 'settle', name: '结算', total: 4, done: false, hit: null, t: 0, pct: 0, timingStarted: false },
      ];
      ps.idx = 0;
      ps.settled = false;
      ps.timing = null;
      const skipRules = ps.phases[0].total <= 0;
      this.logPlay(`—— 第 ${ps.round} 局开始${skipRules ? '（规则已熟，跳过读规则）' : ''} ——`);
    },

    /** 帧推进（对应原型 advancePlay；时机条交互状态在 timing 上） */
    advancePlay(ps: PlaySession, dtMs: number) {
      // 时长为 0 的段（如已读规则）直接跳过
      while (ps.idx < ps.phases.length && ps.phases[ps.idx].total <= 0) {
        ps.phases[ps.idx].done = true;
        ps.idx++;
      }
      if (ps.idx >= ps.phases.length) {
        this.finishPlay();
        return;
      }
      const p = ps.phases[ps.idx];
      const durMs = Math.max(1200, p.total * 1000); // 游戏内 1 分 = 现实 1 秒
      if (!p.timingStarted) {
        p.timingStarted = true;
        ps.timing = {
          phaseIdx: ps.idx,
          t0: Date.now(),
          durMs,
          zl: 15 + Math.random() * 50,
          zw: goldZoneWidth(this.s),
          pos: 0,
          judged: false,
        };
      }
      const tm = ps.timing;
      if (tm && !tm.judged) {
        const el = (Date.now() - tm.t0) / tm.durMs;
        if (el >= 1) {
          // 超时未点：视为普通（对应原型 frame() 里 el>=1 → cleanup → onDone(false)）
          p.hit = false;
          ps.timing = null;
        } else {
          tm.pos = cursorPos(el);
        }
      }
      p.t += dtMs;
      p.pct = Math.min(100, (p.t / durMs) * 100);
      if (p.pct >= 100 && p.hit !== null) {
        p.done = true;
        ps.idx++;
        if (ps.idx >= ps.phases.length) this.finishPlay();
      }
    },

    /** 点击进度条或按空格：判定光标是否落在金区；命中该段进度 +50%（封顶 80%） */
    judgeTiming() {
      const ps = this.session;
      if (!ps || ps.settled || !ps.timing || ps.timing.judged) return;
      const tm = ps.timing;
      const p = ps.phases[tm.phaseIdx];
      const el = (Date.now() - tm.t0) / tm.durMs;
      const pos = cursorPos(el);
      const hit = pos >= tm.zl && pos <= tm.zl + tm.zw;
      p.hit = hit;
      if (hit) {
        p.t = Math.min(p.t + 0.5 * tm.durMs, 0.8 * tm.durMs);
        this.logPlay(`${p.name}：时机完美！进度猛增至 ${Math.round((p.t / tm.durMs) * 100)}%`, 'hit');
      }
      ps.timing = null;
    },

    /** 一局结算（对应原型 finishPlay） */
    finishPlay() {
      const ps = this.session;
      if (!ps || ps.settled) return;
      ps.settled = true;
      ps.timing = null;
      const res = settleRound(this.s, ps.gameId, ps.round);
      const g = gameById(ps.gameId);
      const gainStr = Object.entries(res.gains)
        .map(([a, v]) => `${ATTR_ICON[a as Attr]}${a}+${(v ?? 0).toFixed(1)}`)
        .join('　');
      this.logPlay(
        `✅ 第 ${res.round} 局结算：${gainStr}，收入 ¥${res.pay}${res.ticketDrop ? '，掉落🎫×1！' : ''}`,
        'good',
      );
      if (res.tired) this.logPlay(`《${g.name}》有点玩腻了（疲劳 ${res.fatigue}），换一盒收益更高。`, 'bad');
      this.saveGame();
      if (ps.stopAfter) {
        const rounds = ps.round;
        this.clearSession();
        this.toast(`连刷结束，共完成 ${rounds} 局。`);
        return;
      }
      // 自动连刷：1.2 秒后开始下一局（可被「下轮换它」切换）
      const nextId = ps.nextId || ps.gameId;
      this.logPlay(nextId !== ps.gameId ? `下一局换《${gameById(nextId).name}》……` : '下一局即将开始……', 'mut');
      ps.restartTimer = window.setTimeout(() => {
        if (this.session === ps) this.beginRound(nextId);
      }, 1200);
    },

    clearSession() {
      const ps = this.session;
      if (!ps) return;
      if (ps.restartTimer !== null) {
        clearTimeout(ps.restartTimer);
        ps.restartTimer = null;
      }
      this.session = null;
    },

    switchPlay(id: string) {
      const ps = this.session;
      if (!ps) return;
      ps.nextId = id;
      this.toast(`本轮结束后切换为《${gameById(id).name}》`);
    },

    stopAfterRound() {
      const ps = this.session;
      if (!ps) return;
      ps.stopAfter = true;
      this.toast('本轮结算后停止连刷');
    },

    cancelPlay() {
      this.clearSession();
      this.toast('已停止游玩');
    },

    // ---------- 获得桌游 / 开局 ----------

    pickStarter(id: string) {
      const r = corePickStarter(this.s, id);
      if (r.ok) {
        this.showStarter = false;
        this.toast(r.message);
        this.saveGame();
      } else {
        this.toast(r.reason);
      }
    },

    buyTb(id: string) {
      const r = buyTaobao(this.s, id);
      if (r.ok) {
        this.toast(r.message);
        this.saveGame();
      }
    },

    buyXy(index: number) {
      const r = buyXianyu(this.s, index);
      if (r.ok && r.gameId) {
        const g = gameById(r.gameId);
        const bonus = r.acquire?.first ? `开箱奖励：全属性经验 +${Math.round(r.acquire.bonusExp)}` : '';
        this.toast(`淘到《${g.name}》！${bonus}`);
        this.saveGame();
      }
    },

    refreshXy(paid: boolean) {
      const r = refreshXianyu(this.s, paid);
      if (!r.ok && r.reason) this.toast(r.reason);
    },

    pullGacha(useTicket: boolean) {
      const r = gachaDraw(this.s, useTicket);
      if ('error' in r) {
        this.toast(r.error);
        return;
      }
      const g = gameById(r.gameId);
      if (r.duplicate) {
        this.gachaLog.unshift({
          rar: r.rarity,
          dup: true,
          name: g.name,
          text: `→ 转化 牌套 ×${r.sleevePacks} 包（${r.sleeveSheets} 张）+ 熟练度 +${r.profGain}`,
          cls: r.rarity === 'N' ? '' : 'hit',
        });
      } else {
        const bonus = r.acquire.first ? `开箱奖励：全属性经验 +${Math.round(r.acquire.bonusExp)}` : '';
        this.gachaLog.unshift({
          rar: r.rarity,
          dup: false,
          name: g.name,
          text: `！${bonus}`,
          cls: r.rarity !== 'N' ? 'hit' : '',
        });
      }
      this.saveGame();
    },

    sleeve(id: string) {
      const r = applySleeve(this.s, id);
      if (r.ok) {
        this.toast(r.message);
        this.saveGame();
      } else {
        this.toast(r.reason);
      }
    },

    storage(id: string) {
      const r = applyStorage(this.s, id);
      if (r.ok) {
        this.toast(r.message);
        this.saveGame();
      }
    },

    doTakeJob(id: string) {
      takeJob(this.s, id);
      this.toast(`已上岗：${jobById(id)?.name ?? id}`);
      this.saveGame();
    },

    doQuitJob() {
      quitJob(this.s);
      this.saveGame();
    },

    claim() {
      const amount = claimOffline(this.s);
      this.toast(`领取离线收益 ¥${fmt(amount)}`);
      this.saveGame();
    },
  },
});
