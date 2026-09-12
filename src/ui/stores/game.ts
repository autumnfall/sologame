import { defineStore } from 'pinia';
import {
  ATTR_ICON,
  XY_REFRESH_MS,
  accumulateOffline,
  applySleeve,
  applyStorage,
  buyTaobao,
  buyXianyu,
  buyPerk,
  checkAchievements,
  autoSwitchTarget,
  isFeatureUnlocked,
  isMastered,
  sleeveAll,
  listWornCopies,
  MASTER_POOL_SLEEVES,
  conditionText,
  copyByUid,
  copiesOf,
  defaultState,
  doPrestige,
  emptyOfflineBank,
  exchangeHiTickets,
  expandMarketSlots,
  expandSellSlots,
  fmt,
  gameById,
  gachaDraw,
  GACHA_PRICE,
  goldZoneWidth,
  initTaobaoStock,
  listCopy,
  load,
  jobById,
  parseSave,
  pickStarter as corePickStarter,
  playDuration,
  quitJob,
  refreshXianyu,
  ROTATION_PRICE,
  respecPerks,
  rotatingThemeText,
  ruleDuration,
  save,
  serialize,
  settleRound,
  setupDuration,
  takeJob,
  tickRotation,
  tickSecond,
  tickXianyu,
  toggleLock,
  unlistCopy,
  canPrestige,
  insightGain,
  wipeSave,
} from '../../core';
import type { Attr, GameState, GachaPay, GachaPool, Rarity } from '../../core';

export type TabKey = 'play' | 'work' | 'shop' | 'shelf' | 'prestige' | 'guide';
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
  /** 本局使用的实体 uid（多实体游戏由选择器决定；换游戏时自动挑一个可用实体） */
  copyUid: number | null;
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
  /** 牌套结果用 '🎴' 占位（RAR_COLOR 无此键则不着色） */
  rar: Rarity | '🎴';
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

/** 耐久可能带 .5（牌套磨损减半），展示时去掉多余的 .0 */
function durText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const useGameStore = defineStore('game', {
  state: () => ({
    s: defaultState() as GameState,
    tab: 'play' as TabKey,
    shopTab: 'taobao' as ShopTabKey,
    playFilter: null as Attr | null,
    shelfFilter: null as Attr | null,
    playNotTiredOnly: false,
    playUnmasteredOnly: false,
    shelfNotTiredOnly: false,
    shelfUnmasteredOnly: false,
    session: null as PlaySession | null,
    playLog: [] as LogLine[],
    gachaLog: [] as GachaEntry[],
    showStarter: false,
    showOffline: false,
    /** 转生后待开新周目：先停留在转生页投资阅历，点「开启新周目」才弹三选一 */
    pendingStarter: false,
    toastMsg: '',
    toastOn: false,
    nowMs: Date.now(),
    lastTick: 0,
    secAcc: 0,
    /** 多实体游戏开玩前的实体选择（gameId；null = 未在选择中） */
    pendingCopyPick: null as string | null,
    /** 收藏架「某鱼上架」跳转时预选的要上架实体 uid */
    sellPickUid: null as number | null,
  }),
  getters: {
    /** 离线时长文本（总结弹窗用） */
    offlineTime(state): string {
      const m = Math.floor(state.s.offlineBank.t / 60000);
      if (m >= 60) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
      return `${m} 分钟`;
    },
    /** 某鱼到货倒计时 mm:ss */
    xyCd(state): string {
      const r = Math.max(0, state.s.xyNext - state.nowMs);
      return `${Math.floor(r / 60000)}:${String(Math.floor(r / 1000) % 60).padStart(2, '0')}`;
    },
    /** 轮换赏池换主题倒计时 mm:ss */
    rotCd(state): string {
      const r = Math.max(0, state.s.rotNext - state.nowMs);
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
      tickRotation(this.s); // 补开轮换赏池（老存档 rotNext=0）
      if (!this.s.started) {
        refreshXianyu(this.s, false);
        save(this.s);
        if (this.s.prestige.runs > 0) {
          // 转生后重进：先停留转生页投资阅历，手动开启新周目（老友馈赠等开局天赋需在三选一前持有）
          this.pendingStarter = true;
          this.tab = 'prestige';
        } else {
          this.showStarter = true;
        }
      } else {
        if (!this.s.xyNext) this.s.xyNext = Date.now() + XY_REFRESH_MS;
        if (!this.s.xianyuBuys.length) refreshXianyu(this.s, false);
        const away = Date.now() - this.s.lastSeen;
        if (away > 60000) {
          accumulateOffline(this.s, away);
          const b = this.s.offlineBank;
          if (b.workMoney > 0 || b.playRounds > 0) this.showOffline = true;
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

    /** 每秒一次：工作周期推进 + 某鱼自动到货/成交 + 某赏轮换池计时 + 成就扫描 */
    tickOnce() {
      const r = tickSecond(this.s);
      if (r.payout) this.toast(`💼 工作周期结算 +¥${fmt(r.payAmount)}`);
      if (r.ticketDrop) this.toast('🎫 工作中捡到一张某赏抽赏券！');
      if (r.streamEvent) this.toast('📺 直播事件：' + r.streamEvent);
      const xy = tickXianyu(this.s);
      if (xy.refreshed) this.toast('🔄 某鱼自动到货一批新货源');
      for (const sold of xy.sold) this.toast(`《${sold.name}》已售出，到账 ¥${sold.gain}`);
      const rot = tickRotation(this.s);
      if (rot.changed && rot.theme) this.toast(`桌游池更新：${rotatingThemeText(rot.theme)}`);
      const fresh = checkAchievements(this.s);
      if (fresh.length) {
        const names = fresh.map(a => `「${a.name}」`).join('');
        this.toast(`🏆 达成成就 ${names} 等 ${fresh.length} 项，全局经验 +${fresh.length}%`);
      }
    },

    logPlay(text: string, cls = '') {
      this.playLog.push({ text, cls });
      if (this.playLog.length > 60) this.playLog.splice(0, this.playLog.length - 60);
    },

    // ---------- 游玩会话 ----------

    /**
     * 开玩入口：单实体直接开局；多实体先弹实体选择器
     *（pendingCopyPick 由页面弹选择器，选定后走 pickCopy → startPlay）
     */
    requestPlay(id: string) {
      if (this.session) return;
      const avail = copiesOf(this.s, id);
      if (!avail.length) {
        this.toast('没有可游玩的实体（可能已全部上架某鱼）');
        return;
      }
      if (avail.length > 1) {
        this.pendingCopyPick = id;
        return;
      }
      this.startPlay(id, avail[0].uid);
    },

    /** 实体选择器选定（页面调用） */
    pickCopy(uid: number) {
      const id = this.pendingCopyPick;
      if (!id) return;
      this.pendingCopyPick = null;
      this.startPlay(id, uid);
    },

    cancelCopyPick() {
      this.pendingCopyPick = null;
    },

    startPlay(id: string, copyUid: number) {
      if (this.session) return;
      this.playLog = [];
      this.session = {
        gameId: id,
        copyUid,
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
      // 换游戏（下轮换它）时自动挑耐久最高的可用实体；本局实体全程固定
      if (ps.copyUid == null || copyByUid(this.s, ps.copyUid)?.gameId !== id) {
        const avail = copiesOf(this.s, id);
        ps.copyUid = avail.reduce((a, b) => (b.durability > a.durability ? b : a), avail[0])?.uid ?? null;
      }
      const copy = ps.copyUid != null ? copyByUid(this.s, ps.copyUid) : undefined;
      ps.gameId = id;
      ps.nextId = null;
      ps.round++;
      ps.phases = [
        { key: 'rules', name: '读规则', total: ruleDuration(this.s, g), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
        { key: 'setup', name: 'Setup', total: setupDuration(this.s, g, copy), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
        { key: 'play', name: '游玩', total: playDuration(this.s, g, copy), done: false, hit: null, t: 0, pct: 0, timingStarted: false },
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
      p.pct = Math.min(100, Math.round((p.t / durMs) * 1000) / 10); // 展示保留 1 位小数
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
      if (ps.copyUid == null) {
        this.toast('没有可游玩的实体了');
        this.clearSession();
        return;
      }
      const g = gameById(ps.gameId);
      let res;
      try {
        res = settleRound(this.s, ps.gameId, ps.copyUid, ps.round);
      } catch (e) {
        // 实体在中途被上架某鱼等：本局作废
        this.toast(e instanceof Error ? e.message : '结算失败');
        this.clearSession();
        return;
      }
      const gainStr = Object.entries(res.gains)
        .map(([a, v]) => `${ATTR_ICON[a as Attr]}${a}+${(v ?? 0).toFixed(1)}`)
        .join('　');
      this.logPlay(
        `✅ 第 ${res.round} 局结算：${gainStr}${res.ticketDrop ? '，掉落🎫×1！' : ''}`,
        'good',
      );
      // 实体磨损：结算后追加耐久变化
      const before = res.durability + res.wear;
      if (res.worn) {
        this.logPlay(`🧰 实体已磨光（耐久 0），本局收益减半`, 'bad');
      } else {
        const copy = copyByUid(this.s, ps.copyUid);
        this.logPlay(
          `🧰 耐久 ${durText(before)}→${durText(res.durability)}${copy?.sleeved ? '（牌套减半磨损）' : ''}${copy?.stored ? '（收纳减缓磨损）' : ''}`,
          'mut',
        );
      }
      if (res.tired) this.logPlay(`《${g.name}》有点玩腻了，换一盒收益更高。`, 'bad');
      this.saveGame();
      if (ps.stopAfter) {
        const rounds = ps.round;
        this.clearSession();
        this.toast(`连刷结束，共完成 ${rounds} 局。`);
        return;
      }
      // 自动连刷：1.2 秒后开始下一局（可被「下轮换它」切换；成就解锁后可按疲劳/精通自动换）
      let nextId = ps.nextId || ps.gameId;
      const mode = this.s.settings.autoSwitch;
      // 只有当前游戏达成条件（玩腻了 / 已精通）才自动更换，否则继续玩当前游戏
      const shouldAuto =
        !ps.nextId &&
        ((mode === 'fatigue' && res.tired) || (mode === 'mastery' && isMastered(this.s, ps.gameId)));
      if (shouldAuto) {
        const t = autoSwitchTarget(this.s, mode, ps.gameId);
        if (t) {
          nextId = t;
          this.logPlay(`🔀 自动更换为《${gameById(t).name}》（${mode === 'fatigue' ? '疲劳' : '精通'}自动更换）`, 'mut');
        }
      }
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
      const it = this.s.xianyuBuys[index];
      const r = buyXianyu(this.s, index);
      if (r.ok && r.gameId) {
        const g = gameById(r.gameId);
        if (it?.blind) {
          // 一口价开盒：揭示真实成色/牌套/收纳
          const cond = conditionText(it.durability, g.rarity);
          const extras = `${it.sleeved ? '·已套牌套' : ''}${it.stored ? '·已收纳' : ''}`;
          this.toast(`一口价《${g.name}》开盒：${cond}${extras}！`);
        } else {
          const cond = it ? conditionText(it.durability, g.rarity) : '';
          this.toast(`淘到《${g.name}》${cond ? `（${cond}）` : ''}！`);
        }
        this.saveGame();
      } else if (r.reason) {
        this.toast(r.reason);
      }
    },

    refreshXy(paid: boolean) {
      const r = refreshXianyu(this.s, paid);
      if (!r.ok && r.reason) this.toast(r.reason);
    },

    // ---------- 某赏 ----------

    logGachaOutcome(r: Exclude<ReturnType<typeof gachaDraw>, { error: string }>) {
      const poolTag = r.pool === 'rot' ? '（桌游池）' : r.pool === 'master' ? '（精通池）' : '';
      if (r.kind === 'sleeves') {
        this.gachaLog.unshift({
          rar: '🎴',
          dup: false,
          name: `${r.packs} 包牌套`,
          text: `+${r.sleeves} 张牌套${poolTag}`,
          cls: '',
        });
      } else if (r.kind === 'prof') {
        const g = gameById(r.gameId);
        this.gachaLog.unshift({
          rar: r.rarity,
          dup: false,
          name: g.name,
          text: `熟练 +${r.prof}${r.masteredNow ? '，已精通！' : ''}${poolTag}`,
          cls: r.rarity === 'N' ? '' : 'hit',
        });
      } else {
        const g = gameById(r.gameId);
        if (r.duplicate) {
          this.gachaLog.unshift({
            rar: r.rarity,
            dup: true,
            name: g.name,
            text: `直接获得新实体${poolTag}（收藏级进度保留，可挂某鱼出售）`,
            cls: r.rarity === 'N' ? '' : 'hit',
          });
        } else {
          const bonus = r.acquire.first ? `开箱奖励：${r.acquire.bonusAttrs.join('、')}经验 +${Math.round(r.acquire.bonusExp)}` : '';
          this.gachaLog.unshift({
            rar: r.rarity,
            dup: false,
            name: g.name,
            text: `新收藏！${bonus}${poolTag}`,
            cls: r.rarity !== 'N' ? 'hit' : '',
          });
        }
      }
    },

    pullGacha(pool: GachaPool, pay: GachaPay) {
      const r = gachaDraw(this.s, pool, pay);
      if ('error' in r) {
        this.toast(r.error);
        return;
      }
      this.logGachaOutcome(r);
      this.saveGame();
    },

    /** 十连抽（成就里程碑解锁）：10 倍价格/券，保底逐抽正常累积 */
    pullGachaTen(pool: GachaPool, pay: GachaPay) {
      if (!isFeatureUnlocked(this.s, 'tenPull')) {
        this.toast('十连抽尚未解锁（达成 10 个成就）');
        return;
      }
      if (pool === 'master') {
        if (this.s.sleeves < MASTER_POOL_SLEEVES * 10) return this.toast(`牌套不够十连（需要 ${MASTER_POOL_SLEEVES * 10} 张）`);
        for (let i = 0; i < 10; i++) {
          const r = gachaDraw(this.s, 'master', 'sleeves');
          if ('error' in r) break;
          this.logGachaOutcome(r);
        }
        this.toast('🎰 精通池十连完成！');
        this.saveGame();
        return;
      }
      const price = pool === 'perm' ? GACHA_PRICE : ROTATION_PRICE;
      if (pay === 'money' && this.s.money < price * 10) return this.toast('钱不够十连');
      if (pay === 'ticket' && this.s.tickets < 10) return this.toast('普通券不够 10 张');
      if (pay === 'hiTicket' && this.s.hiTickets < 10) return this.toast('高级券不够 10 张');
      for (let i = 0; i < 10; i++) {
        const r = gachaDraw(this.s, pool, pay);
        if ('error' in r) break;
        this.logGachaOutcome(r);
      }
      this.toast('🎰 十连抽完成！');
      this.saveGame();
    },

    exchangeHi(n: number) {
      const r = exchangeHiTickets(this.s, n);
      if (r.ok) {
        this.toast(`兑换成功：高级券 +${n}`);
        this.saveGame();
      } else {
        this.toast(r.reason ?? '兑换失败');
      }
    },

    // ---------- 实体：牌套 / 收纳 / 某鱼出售 ----------

    sleeve(uid: number) {
      const r = applySleeve(this.s, uid);
      if (r.ok) {
        this.toast(r.message);
        this.saveGame();
      } else {
        this.toast(r.reason);
      }
    },

    storage(uid: number) {
      const r = applyStorage(this.s, uid);
      if (r.ok) {
        this.toast(r.message);
        this.saveGame();
      }
    },

    /** 某鱼上架实体（priceMult 0.5~2.0） */
    listForSale(uid: number, priceMult: number) {
      const r = listCopy(this.s, uid, priceMult);
      this.toast(r.ok ? r.message : r.reason);
      if (r.ok) {
        this.sellPickUid = null;
        this.saveGame();
      }
    },

    unlistForSale(uid: number) {
      const r = unlistCopy(this.s, uid);
      this.toast(r.ok ? r.message : r.reason);
      if (r.ok) this.saveGame();
    },

    expandSell() {
      const r = expandSellSlots(this.s);
      this.toast(r.ok ? r.message : r.reason);
      if (r.ok) this.saveGame();
    },

    expandMarket() {
      const r = expandMarketSlots(this.s);
      this.toast(r.ok ? r.message : r.reason);
      if (r.ok) this.saveGame();
    },

    /** 收藏架「某鱼上架」入口：预选实体并跳到某鱼出售区 */
    gotoSell(uid: number) {
      this.sellPickUid = uid;
      this.tab = 'shop';
      this.shopTab = 'xianyu';
    },

    // ---------- 工作 ----------

    doTakeJob(id: string) {
      takeJob(this.s, id);
      this.toast(`已上岗：${jobById(id)?.name ?? id}`);
      this.saveGame();
    },

    doQuitJob() {
      quitJob(this.s);
      this.saveGame();
    },

    /** 关闭离线总结弹窗（收益早已自动入账） */
    closeOffline() {
      this.s.offlineBank = emptyOfflineBank();
      this.showOffline = false;
      this.saveGame();
    },

    // ---------- 转生 ----------

    /** 退坑转生：确认弹窗后重置本周目，保留阅历/天赋/统计 */
    prestige() {
      const gain = insightGain(this.s);
      if (!canPrestige(this.s)) return;
      if (!window.confirm(`确定退坑出清吗？本周目的收藏、实体、金钱、属性、职业都将重置，获得 ${gain} 点桌游阅历。`)) return;
      if (!window.confirm('再确认一次：阅历和天赋会保留，但本周目的一切进度将消失。')) return;
      const r = doPrestige(this.s);
      if (!r.ok) {
        this.toast(r.reason ?? '无法退坑');
        return;
      }
      this.clearSession();
      // 与 boot 的新开局分支一致：刷首批货源、补开轮换池；强制弹窗先投资阅历再开新周目
      refreshXianyu(this.s, false);
      tickRotation(this.s);
      this.pendingStarter = true;
      this.tab = 'prestige';
      this.toast(`🌅 第 ${this.s.prestige.runs + 1} 周目待开启！阅历 +${r.gain}，先投资天赋再开局`);
      this.saveGame();
    },

    /** 转生页「开启新周目」：弹出三选一（老友馈赠等开局天赋按当前等级结算） */
    startNewRun() {
      if (!this.pendingStarter) return;
      this.pendingStarter = false;
      this.showStarter = true;
    },

    buyPerk(id: string) {
      if (!this.pendingStarter) {
        this.toast('天赋只能在转生后、开启新周目前调整');
        return;
      }
      const r = buyPerk(this.s, id);
      this.toast(r.ok ? `已习得天赋（剩余阅历 ${this.s.prestige.insight}）` : (r.reason ?? '购买失败'));
      if (r.ok) this.saveGame();
    },

    respec() {
      if (!this.pendingStarter) {
        this.toast('洗点只能在转生后、开启新周目前进行');
        return;
      }
      if (!window.confirm('洗点将退还全部已投入的阅历（本周目已获得的出售槽位不回收），确定吗？')) return;
      const r = respecPerks(this.s);
      this.toast(r.ok ? `已洗点，阅历全额退还（现有 ${this.s.prestige.insight}）` : (r.reason ?? '洗点失败'));
      if (r.ok) this.saveGame();
    },

    // ---------- 成就功能解锁 ----------

    /** 疲劳/精通自动更换开关（两档互斥；需对应里程碑解锁） */
    toggleAutoSwitch(mode: 'fatigue' | 'mastery') {
      const key = mode === 'fatigue' ? 'autoFatigue' : 'autoMastery';
      if (!isFeatureUnlocked(this.s, key)) {
        const need = mode === 'fatigue' ? 5 : 25;
        this.toast(`该功能尚未解锁（达成 ${need} 个成就）`);
        return;
      }
      this.s.settings.autoSwitch = this.s.settings.autoSwitch === mode ? 'off' : mode;
      const label = mode === 'fatigue' ? '疲劳自动更换' : '精通自动更换';
      this.toast(this.s.settings.autoSwitch === mode ? `已开启${label}` : `已关闭${label}`);
      this.saveGame();
    },

    /** 某鱼快速上架开关（成就 30 个解锁）：开启后收藏架点「某鱼上架」直接按 100% 市价上架 */
    toggleQuickList() {
      if (!isFeatureUnlocked(this.s, 'quickList')) {
        this.toast('该功能尚未解锁（达成 30 个成就）');
        return;
      }
      this.s.settings.quickList = !this.s.settings.quickList;
      this.toast(this.s.settings.quickList
        ? '已开启某鱼快速上架：收藏架点「某鱼上架」直接按行情价 100% 上架'
        : '已关闭某鱼快速上架');
      this.saveGame();
    },

    /** 收藏架锁定/解锁实体 */
    toggleCopyLock(uid: number) {
      const r = toggleLock(this.s, uid);
      this.toast(r.ok ? r.message : r.reason);
      if (r.ok) this.saveGame();
    },

    sleeveAllCopies() {
      const r = sleeveAll(this.s);
      this.toast(r.count > 0 ? `一键套牌套完成：${r.count} 盒实体（消耗 ${r.used} 张）` : '没有可套的实体（牌套可能不够）');
      if (r.count > 0) this.saveGame();
    },

    listWorn() {
      const r = listWornCopies(this.s);
      this.toast(r.count > 0 ? `已上架 ${r.count} 件磨光实体（行情价 100%）` : '没有可上架的磨光实体（或槽位已满）');
      if (r.count > 0) this.saveGame();
    },

    // ---------- 存档管理：导出 / 导入 / 重新开始 ----------

    /** 导出存档为 JSON 文件下载 */
    exportSave() {
      this.saveGame();
      const blob = new Blob([serialize(this.s)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `桌游收藏家存档-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('存档已导出');
    },

    /** 导入存档文件：校验并迁移后写入本地，刷新页面生效 */
    async importSaveFile(file: File) {
      const text = await file.text();
      const s = parseSave(text);
      if (!s) {
        this.toast('存档文件无效或版本高于当前游戏');
        return;
      }
      this.s = s; // 先换内存态：否则 reload 触发的 beforeunload 自动保存会把旧档写回，覆盖导入的存档
      save(s);
      window.location.reload();
    },

    /** 清空存档重新开始（二次确认） */
    resetGame() {
      if (!window.confirm('确定要清空当前存档、从头开始吗？此操作不可恢复！')) return;
      if (!window.confirm('再确认一次：所有收藏、实体、金钱、属性进度都将被删除。')) return;
      this.s = defaultState(); // 先换内存态：否则 reload 触发的 beforeunload 自动保存会把旧档写回，清档失效
      wipeSave();
      window.location.reload();
    },
  },
});
