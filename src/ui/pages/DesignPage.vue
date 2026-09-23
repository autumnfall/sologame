<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ACTIVITY_DAILY_LIMIT, ATTR_ICON, CROWD_DAYS_MAX, CROWD_DAYS_MIN,
  CROWD_GOAL_MAX, CROWD_GOAL_MIN, CROWD_SUCCESS_LIMIT, DAY_SECONDS,
  DESIGN_DIMS, EXPOSURE_SOFTCAP, FOUND_COST,
  ITER_MAX, PLATFORMS, PREHEAT_MIN, PRICE_RATIO_MAX, PRICE_RATIO_MIN,
  SCALES, THEMES, attrLevel, convertRate, costPriceOf, dimByKey,
  eventById, eventOptionCheck, fmt, inspireCap, iterCost, platformById, playtestCost,
  preheatMax, promoCost, qualityOf, rarityOf, scaleById, themeById,
  themeDimKey, watcherDailyGain,
} from '../../core';
import { useGameStore } from '../stores/game';

const store = useGameStore();

// ---------- 立项 ----------

const name = ref('');
const themeId = ref(THEMES[0].id);
const scale = ref('standard');
const nameOk = computed(() => {
  const len = name.value.trim().length;
  return len >= 2 && len <= 10;
});
const canFound = computed(() => nameOk.value && store.s.designer.inspiration >= FOUND_COST);

function doFound() {
  store.foundPrototype(name.value, themeId.value, scale.value);
  name.value = '';
}

// ---------- 原型卡：迭代 + 经营 ----------

const homeDim = (tid: string) => themeDimKey(themeById(tid));

function dimGain(tid: string, dimKey: string): number {
  const dim = dimByKey(dimKey);
  return 2 + Math.floor(0.4 * attrLevel(store.s, dim.attr)) + (dimKey === homeDim(tid) ? 1 : 0);
}

function nextIterCost(n: number): number | null {
  return n >= ITER_MAX ? null : iterCost(n + 1);
}

const ACTIVITY_META = [
  { key: 'playtest', icon: '🎲', label: '组织试玩', gain: '曝光+8~15 · 种子+0~3' },
  { key: 'promo', icon: '📣', label: '社媒宣传', gain: '曝光+5~10' },
  { key: 'diary', icon: '📓', label: '设计日记', gain: '灵感3 → 曝光+4' },
] as const;

function activityCost(p: { activities: Record<string, number> }, key: string): number {
  const n = p.activities[key] ?? 0;
  return key === 'playtest' ? playtestCost(n) : promoCost(n);
}

/** 今日剩余次数（游戏时间日 = 24 秒） */
function activityLeft(p: { activityDay: number; activityCount: Record<string, number> }, key: string): number {
  const day = Math.floor(store.nowMs / 1000 / DAY_SECONDS);
  const used = p.activityDay === day ? (p.activityCount[key] ?? 0) : 0;
  return key === 'diary' ? Infinity : ACTIVITY_DAILY_LIMIT - used;
}

// ---------- 发起预热 ----------

const launchFor = ref<number | null>(null);
const platformId = ref('moudian');
const goalInput = ref(200);
const daysInput = ref(60);
const preheatInput = ref(10);
const ratioPct = ref(100);

const launchState = computed(() => {
  const proto = store.s.designer.prototypes.find(p => p.uid === launchFor.value) ?? null;
  if (!proto) return null;
  const q = qualityOf(store.s, proto);
  const costPrice = costPriceOf(q, proto.scale);
  const ratio = Math.min(PRICE_RATIO_MAX, Math.max(PRICE_RATIO_MIN, ratioPct.value / 100));
  const price = Math.max(1, Math.round(costPrice * ratio));
  const p = Math.min(preheatMax(daysInput.value), Math.max(PREHEAT_MIN, preheatInput.value));
  const perDay = watcherDailyGain(proto.exposure, platformId.value, ratio, q);
  const estWatchers = proto.seeds + p * perDay;
  const rate = convertRate(q, ratio);
  return { proto, q, costPrice, ratio, price, p, perDay, estWatchers, rate, initSupport: Math.floor(estWatchers * rate) };
});

function doLaunch(uid: number) {
  store.startPreheat(uid, platformId.value, goalInput.value, daysInput.value, preheatInput.value, ratioPct.value / 100);
  launchFor.value = null;
}

// ---------- 众筹面板 ----------

const resolveFor = ref<string | number | null>(null); // campaignUid + pendingIdx 展开
const eventCheck = (c: Parameters<typeof eventOptionCheck>[1], opt: Parameters<typeof eventOptionCheck>[2]) =>
  eventOptionCheck(store.s, c, opt);

const remainingDays = (c: { days: number; elapsedSec: number }) =>
  Math.max(0, Math.ceil((c.days * DAY_SECONDS - c.elapsedSec) / DAY_SECONDS));

const preheatLeft = (c: { preheatDays: number; elapsedSec: number }) =>
  Math.max(0, Math.ceil((c.preheatDays * DAY_SECONDS - c.elapsedSec) / DAY_SECONDS));

function fmtEvent(e: { eventId: string; optionIdx: number; byDefault: boolean; result: string; kind: string; day: number }) {
  if (e.kind === 'milestone') return `第 ${e.day} 天 · ${e.result}`;
  const def = eventById(e.eventId);
  const opt = def.options[e.optionIdx];
  return `第 ${e.day} 天 · ${def.name}：${opt ? opt.label : ''}${e.byDefault ? '（默认兜底）' : ''} → ${e.result}`;
}
</script>

<template>
  <div>
    <h2>🎨 桌游设计师</h2>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span>💡 灵感：<b class="price" style="font-size:18px">{{ fmt(Math.floor(store.s.designer.inspiration)) }}</b>
          <small class="mut">/ {{ inspireCap(store.s) }}（基础 100，每精通一款按稀有度 +1~+4）</small></span>
        <span class="mut">原型 {{ store.s.designer.prototypes.length }} · 进行中 {{ store.s.designer.campaigns.length }} · 已成功 {{ store.s.designer.successCount }} 款</span>
      </div>
      <div class="mut" style="margin-top:6px;font-size:12px">
        游玩攒灵感（按时长，单局至多 5 点）→ 立项 → 经营曝光（试玩/宣传/日记）+ 打磨 6 维度 → 选平台、分配预热/众筹时间 → 众筹期按游戏日攒支持（每日 k×10 人判定）、应对事件 → 到期达标分两阶段回款（先收一半，交付垫资收尾款）。
      </div>
    </div>

    <template v-if="!store.s.designer.unlocked">
      <div class="panel mut" style="margin-bottom:12px">
        🔒 担任「桌游设计师」职业（全属性 4 级解锁的工作岗位）后开启设计玩法。
      </div>
    </template>

    <template v-else>
      <!-- 立项区 -->
      <div class="panel" style="margin-bottom:12px">
        <h3 style="margin:0 0 8px">🛠 立项 <small class="mut">-{{ FOUND_COST }}💡</small></h3>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
          <label style="font-size:13px">
            名称
            <input v-model="name" maxlength="12" placeholder="2~10 字"
              style="background:var(--panel2);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:5px 10px;font-size:13px;width:160px" />
          </label>
          <small v-if="name.trim().length > 0 && !nameOk" class="bad2">需 2~10 字</small>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button v-for="t in THEMES" :key="t.id" :class="{ active: themeId === t.id }" style="padding:3px 10px;font-size:12px"
            :title="`${t.desc}（主场维度：${dimByKey(homeDim(t.id)).name} 增益 +1）`" @click="themeId = t.id">
            {{ t.name }}
          </button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <label v-for="s in SCALES" :key="s.id"
            style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:4px 10px;cursor:pointer"
            :style="scale === s.id ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}">
            <input v-model="scale" type="radio" name="scale" :value="s.id" style="display:none" />
            {{ s.name }} <small class="mut">成本基数 ¥{{ s.costBase }} · 牌套 {{ s.sleeveCost }} 张</small>
          </label>
        </div>
        <button class="primary" :disabled="!canFound" @click="doFound">✨ 立项（-{{ FOUND_COST }}💡）</button>
      </div>

      <!-- 原型卡 -->
      <div v-for="p in store.s.designer.prototypes" :key="p.uid" class="panel" style="margin-bottom:12px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <b style="font-size:15px">《{{ p.name }}》</b>
          <span class="mut" style="font-size:12px">{{ themeById(p.themeId).name }} · {{ scaleById(p.scale).name }}</span>
          <span style="margin-left:auto;font-size:13px">Q <b class="price" style="font-size:16px">{{ qualityOf(store.s, p) }}</b>
            <span class="mut">（{{ rarityOf(qualityOf(store.s, p)) }}）</span></span>
        </div>
        <div class="mut" style="font-size:12px;margin-top:4px">
          📈 曝光 {{ Math.floor(p.exposure) }}{{ p.exposure > EXPOSURE_SOFTCAP ? '（超软上限，收益减半）' : `/${EXPOSURE_SOFTCAP}` }}
          · 🌱 看好种子 {{ p.seeds }}（发起预热时转为初始看好）
        </div>

        <!-- 经营 activity -->
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button v-for="a in ACTIVITY_META" :key="a.key" style="padding:3px 10px;font-size:12px"
            :disabled="store.s.money < activityCost(p, a.key) || store.s.designer.inspiration < 3 && a.key === 'diary' || activityLeft(p, a.key) <= 0"
            :title="a.gain"
            @click="store.runActivity(p.uid, a.key)">
            {{ a.icon }} {{ a.label }}
            <template v-if="a.key === 'diary'">-3💡</template>
            <template v-else>-¥{{ fmt(activityCost(p, a.key)) }}</template>
            <small v-if="a.key !== 'diary'">（今日剩 {{ Math.max(0, activityLeft(p, a.key)) }}/{{ ACTIVITY_DAILY_LIMIT }}）</small>
          </button>
        </div>

        <!-- 6 维度迭代 -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
          <tr v-for="d in DESIGN_DIMS" :key="d.key" style="border-top:1px solid var(--line)">
            <td style="padding:4px">
              {{ dimByKey(d.key).name }}{{ d.key === homeDim(p.themeId) ? ' ★' : '' }}
              <small class="mut">{{ ATTR_ICON[d.attr] }}{{ d.attr }} Lv{{ attrLevel(store.s, d.attr) }}</small>
            </td>
            <td style="padding:4px" class="mut">{{ p.iter[d.key] }}/{{ ITER_MAX }} 次</td>
            <td style="padding:4px" class="mut">本次增益 +{{ dimGain(p.themeId, d.key) }}</td>
            <td style="padding:4px;text-align:right">
              <button v-if="nextIterCost(p.iter[d.key]) !== null" style="padding:2px 10px;font-size:12px"
                :disabled="store.s.designer.inspiration < nextIterCost(p.iter[d.key])!"
                @click="store.iterateProto(p.uid, d.key)">
                打磨 -{{ nextIterCost(p.iter[d.key]) }}💡
              </button>
              <span v-else class="ok" style="font-size:12px">已至极限</span>
            </td>
          </tr>
        </table>

        <div style="margin-top:8px">
          <button style="padding:3px 12px;font-size:12px" @click="launchFor = launchFor === p.uid ? null : p.uid">
            📣 发起预热…
          </button>
        </div>

        <!-- 发起预热参数区 -->
        <div v-if="launchFor === p.uid && launchState" style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <label v-for="pl in PLATFORMS" :key="pl.id"
              style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:4px 10px;cursor:pointer"
              :style="platformId === pl.id ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}">
              <input v-model="platformId" type="radio" name="platform" :value="pl.id" style="display:none" />
              {{ pl.name }} <small class="mut">抽成 {{ Math.round(pl.commission * 100) }}% · 预热基础曝光 {{ pl.baseExposure }}/日 · {{ pl.desc }}</small>
            </label>
          </div>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px">
            <label>目标 <input v-model.number="goalInput" type="number" :min="CROWD_GOAL_MIN" :max="CROWD_GOAL_MAX" style="width:76px" /></label>
            <label style="display:flex;gap:6px;align-items:center">总期限 {{ daysInput }} 天
              <input v-model.number="daysInput" type="range" :min="CROWD_DAYS_MIN" :max="CROWD_DAYS_MAX" style="width:110px" />
            </label>
            <label style="display:flex;gap:6px;align-items:center">预热 {{ launchState.p }} 天
              <input v-model.number="preheatInput" type="range" :min="PREHEAT_MIN" :max="preheatMax(daysInput)" style="width:110px" />
            </label>
            <label style="display:flex;gap:6px;align-items:center">定价 {{ ratioPct }}%
              <input v-model.number="ratioPct" type="range" :min="PRICE_RATIO_MIN * 100" :max="PRICE_RATIO_MAX * 100" step="10" style="width:120px" />
            </label>
          </div>
          <div class="mut" style="font-size:12px;margin-top:6px">
            成本价 ¥{{ fmt(launchState.costPrice) }} → 售价 ¥{{ fmt(launchState.price) }}；
            预计看好 ≈ {{ launchState.estWatchers }}（种子 {{ launchState.proto.seeds }} + {{ launchState.p }} 天 × {{ launchState.perDay }}/日）
            → 开众筹初始支持 ≈ {{ launchState.initSupport }}（转化率 {{ (launchState.rate * 100).toFixed(0) }}%）
          </div>
          <div style="margin-top:8px">
            <button class="primary" style="padding:4px 16px;font-size:13px" @click="doLaunch(p.uid)">
              📣 确认发起（Q{{ launchState.q }} · {{ rarityOf(launchState.q) }} · {{ platformById(platformId).name }}，选定不可换）
            </button>
            <button style="margin-left:8px;padding:4px 12px;font-size:13px" @click="launchFor = null">取消</button>
          </div>
        </div>
      </div>

      <!-- 进行中（预热/众筹） -->
      <div v-for="c in store.s.designer.campaigns" :key="c.uid" class="panel" style="margin-bottom:12px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px">
          <b>《{{ c.name }}》</b>
          <span class="mut">{{ themeById(c.themeId).name }} · {{ scaleById(c.scale).name }} · {{ platformById(c.platformId).name }}</span>
          <span :class="c.rarity === 'N' ? 'mut' : 'price'">{{ c.rarity }}</span>
          <span :class="c.status === 'preheat' ? 'price' : 'ok'">{{ c.status === 'preheat' ? '🔥 预热中' : '📣 众筹中' }}</span>
          <span style="margin-left:auto">¥{{ fmt(c.price) }}<small class="mut">/份 · 目标 {{ c.goal }} 人</small></span>
        </div>

        <!-- 预热面板 -->
        <template v-if="c.status === 'preheat'">
          <div class="bar" style="margin-top:6px;height:8px">
            <i :style="{ width: Math.min(100, Math.round((c.elapsedSec / (c.preheatDays * DAY_SECONDS)) * 1000) / 10) + '%' }"></i>
          </div>
          <div class="mut" style="font-size:12px;margin-top:4px">
            🌟 看好 {{ c.watchers }} 人 · 曝光 {{ Math.floor(c.exposure) }} · 剩 {{ preheatLeft(c) }} 天预热（随后 {{ c.days - c.preheatDays }} 天众筹）
          </div>
          <button style="margin-top:6px;padding:2px 10px;font-size:12px"
            :disabled="store.s.money < promoCost(c.boostCount)"
            @click="store.boostCampaign(c.uid)">
            📣 追加宣传 -¥{{ fmt(promoCost(c.boostCount)) }}（只加曝光，按剩余天数折算看好）
          </button>
        </template>

        <!-- 众筹面板 -->
        <template v-else>
          <div class="bar" style="margin-top:6px;height:8px">
            <i :style="{ width: Math.min(100, Math.round((c.supporters / c.goal) * 1000) / 10) + '%' }"></i>
          </div>
          <div class="mut" style="font-size:12px;margin-top:4px">
            {{ c.supporters }}/{{ c.goal }} 人 · 剩 {{ remainingDays(c) }} 天 · 看好转化 {{ c.supporters ? '' : `${Math.floor(c.watchers)} 看好 × ${(c.convertRate * 100).toFixed(0)}%` }}
            {{ c.flowMult > 1 ? ` · 流量 ×${c.flowMult.toFixed(2)}` : '' }}
          </div>

          <!-- 待决事件 -->
          <div v-for="(pe, pi) in c.pendingEvents" :key="pe.eventId + pi" style="margin-top:6px;border:1px solid var(--line);border-radius:8px;padding:6px 8px">
            <div style="display:flex;gap:8px;align-items:center;font-size:13px">
              <b>⚡ {{ eventById(pe.eventId).name }}</b>
              <small class="mut">剩余 {{ Math.ceil(pe.remainingSec) }}s</small>
              <button style="margin-left:auto;padding:1px 8px;font-size:11px" @click="resolveFor = resolveFor === c.uid + '-' + pi ? null : c.uid + '-' + pi">
                抉择…
              </button>
            </div>
            <div v-if="resolveFor === c.uid + '-' + pi" style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
              <button v-for="(opt, oi) in eventById(pe.eventId).options" :key="oi" style="padding:3px 10px;font-size:12px;text-align:left"
                :disabled="!eventCheck(c, opt).ok"
                :title="!eventCheck(c, opt).ok ? eventCheck(c, opt).reason : ''"
                @click="store.resolveEvent(c.uid, pi, oi); resolveFor = null">
                {{ opt.label }}{{ opt.isDefault ? '（默认）' : '' }}
                <small v-if="!eventCheck(c, opt).ok" class="bad2">— {{ eventCheck(c, opt).reason }}</small>
              </button>
            </div>
          </div>
        </template>

        <!-- 历史记录 -->
        <details v-if="c.eventHistory.length" style="margin-top:6px;font-size:12px">
          <summary class="mut">📜 事件与里程碑记录（{{ c.eventHistory.length }}）</summary>
          <div v-for="(h, hi) in c.eventHistory" :key="hi" class="mut" style="padding:2px 0">· {{ fmtEvent(h) }}</div>
        </details>
      </div>

      <!-- 已众筹成功 -->
      <div v-if="store.s.designer.funded.length" class="panel" style="margin-bottom:12px">
        <h3 style="margin:0 0 8px">
          🏆 已众筹成功 <small class="mut">{{ store.s.designer.successCount }} 款</small>
          <small v-if="store.s.designer.successCount < CROWD_SUCCESS_LIMIT" class="mut">· 还差 {{ CROWD_SUCCESS_LIMIT - store.s.designer.successCount }} 款解锁出版玩法</small>
          <small v-else class="ok">· 出版玩法将在后续版本开放</small>
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr class="mut" style="text-align:left">
            <th style="padding:3px 4px">名称</th><th>稀有度</th><th>Q</th><th>支持</th><th>结算</th>
          </tr>
          <tr v-for="f in store.s.designer.funded" :key="f.uid" style="border-top:1px solid var(--line)">
            <td style="padding:3px 4px">《{{ f.name }}》<small v-if="!f.delivered" class="warn"> 待交付</small></td>
            <td>{{ f.rarity }}</td>
            <td>{{ f.score }}</td>
            <td>{{ f.supporters }}</td>
            <td style="padding:3px 4px">
              <small class="mut">
                抽成 ¥{{ fmt(f.commission) }} · 已到账 ¥{{ fmt(f.firstPayment) }} · 尾款 ¥{{ fmt(f.remainPayment) }}
              </small>
              <template v-if="!f.delivered">
                <small class="mut">· 交付垫资 ¥{{ fmt(f.cost) }}，</small>
                <small :class="f.income - f.commission - f.cost >= 0 ? 'ok' : 'bad2'">
                  净{{ f.income - f.commission - f.cost >= 0 ? '收益' : '亏损' }} ¥{{ fmt(Math.abs(f.income - f.commission - f.cost)) }}
                </small>
                <button style="margin-left:6px;padding:2px 10px;font-size:12px" :disabled="store.s.money < f.cost"
                  :title="store.s.money < f.cost ? `交付需垫资 ¥${fmt(f.cost)}，资金不足` : ''"
                  @click="store.deliverDesign(f.uid)">📦 交付</button>
              </template>
              <small v-else :class="f.income - f.commission - f.cost >= 0 ? 'ok' : 'bad2'"> · 已交付</small>
            </td>
          </tr>
        </table>
      </div>

      <!-- 已失败 -->
      <div v-if="store.s.designer.failed.length" class="panel" style="margin-bottom:12px">
        <h3 style="margin:0 0 8px">😢 已失败 <small class="mut">原型已退回，可调整后再发起</small></h3>
        <div v-for="(f, i) in store.s.designer.failed" :key="f.uid + '-' + i" class="mut" style="font-size:12px;border-top:1px solid var(--line);padding:4px 0">
          《{{ f.name }}》 目标 {{ f.goal }} 人 / {{ f.days }} 天，仅 {{ f.supporters }} 人支持
        </div>
      </div>
    </template>
  </div>
</template>
