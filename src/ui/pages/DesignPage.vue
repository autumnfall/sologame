<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ATTR_ICON,
  CROWD_DAYS_MAX,
  CROWD_DAYS_MIN,
  CROWD_GOAL_MAX,
  CROWD_GOAL_MIN,
  CROWD_SUCCESS_LIMIT,
  DAY_SECONDS,
  DESIGN_DIMS,
  FOUND_COST,
  ITER_MAX,
  PRICE_RATIO_MAX,
  PRICE_RATIO_MIN,
  SCALES,
  THEMES,
  attrLevel,
  costPriceOf,
  demandHint,
  dimByKey,
  fmt,
  iterCost,
  qualityOf,
  rarityOf,
  scaleById,
  themeById,
  themeDimKey,
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

// ---------- 原型卡 ----------

const homeDim = (themeId: string) => themeDimKey(themeById(themeId));

function dimGain(themeId: string, dimKey: string): number {
  const dim = dimByKey(dimKey);
  return 2 + Math.floor(0.4 * attrLevel(store.s, dim.attr)) + (dimKey === homeDim(themeId) ? 1 : 0);
}

function nextIterCost(n: number): number | null {
  return n >= ITER_MAX ? null : iterCost(n + 1);
}

/** 发起众筹参数（每原型一组） */
const launchFor = ref<number | null>(null);
const goalInput = ref(200);
const daysInput = ref(60);
const ratioPct = ref(100); // 100%~1000%

const launchState = computed(() => {
  const proto = store.s.designer.prototypes.find(p => p.uid === launchFor.value) ?? null;
  if (!proto) return null;
  const q = qualityOf(store.s, proto);
  const costPrice = costPriceOf(q, proto.scale);
  const ratio = Math.min(PRICE_RATIO_MAX, Math.max(PRICE_RATIO_MIN, ratioPct.value / 100));
  const price = Math.max(1, Math.round(costPrice * ratio));
  const hint = demandHint(store.s, {
    themeId: proto.themeId, price, costPrice, rarity: rarityOf(q),
  });
  return { proto, q, costPrice, ratio, price, hint };
});

function doLaunch(uid: number) {
  store.launchCrowd(uid, goalInput.value, daysInput.value, ratioPct.value / 100);
  launchFor.value = null;
}

function doIterate(uid: number, dimKey: string) {
  store.iterateProto(uid, dimKey);
}

const remainingDays = (c: { days: number; elapsedSec: number }) =>
  Math.max(0, Math.ceil((c.days * DAY_SECONDS - c.elapsedSec) / DAY_SECONDS));

const estIncome = (c: { supporters: number; price: number }) => c.supporters * c.price;
</script>

<template>
  <div>
    <h2>🎨 桌游设计师</h2>

    <div class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <span>💡 灵感：<b class="price" style="font-size:18px">{{ fmt(Math.floor(store.s.designer.inspiration)) }}</b>
          <small class="mut">/ 999</small></span>
        <span class="mut">原型 {{ store.s.designer.prototypes.length }} · 众筹中 {{ store.s.designer.campaigns.length }} · 已成功 {{ store.s.designer.successCount }} 款</span>
      </div>
      <div class="mut" style="margin-top:6px;font-size:12px">
        游玩收藏获得灵感（N+1 / R+2 / SR+4 / SSR+8，隐藏款 ×2）；花 10 灵感立项，再花灵感打磨 6 个设计维度——
        <b>属性永不消耗</b>，等级越高迭代收益越大（主题主场维度额外 +1）。发起众筹后逐秒积累支持者，到期达标即入账收入。
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
            <input
              v-model="name"
              maxlength="12"
              placeholder="2~10 字"
              style="background:var(--panel2);border:1px solid var(--line);border-radius:6px;color:var(--txt);padding:5px 10px;font-size:13px;width:160px"
            />
          </label>
          <small v-if="name.trim().length > 0 && !nameOk" class="bad2">需 2~10 字</small>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button
            v-for="t in THEMES"
            :key="t.id"
            :class="{ active: themeId === t.id }"
            style="padding:3px 10px;font-size:12px"
            :title="`${t.desc}（主场维度：${dimByKey(homeDim(t.id)).name} 增益 +1）`"
            @click="themeId = t.id"
          >
            {{ t.name }}
          </button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <label
            v-for="s in SCALES"
            :key="s.id"
            style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:4px 10px;cursor:pointer"
            :style="scale === s.id ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}"
          >
            <input v-model="scale" type="radio" name="scale" :value="s.id" style="display:none" />
            {{ s.name }} <small class="mut">成本基数 ¥{{ s.costBase }} · 牌套需求 {{ s.sleeveCost }} 张</small>
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
            <span class="mut">（预估稀有度 {{ rarityOf(qualityOf(store.s, p)) }}）</span></span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
          <tr v-for="d in DESIGN_DIMS" :key="d.key" style="border-top:1px solid var(--line)">
            <td style="padding:4px">
              {{ dimByKey(d.key).name }}{{ d.key === homeDim(p.themeId) ? ' ★' : '' }}
              <small class="mut">{{ ATTR_ICON[d.attr] }}{{ d.attr }} Lv{{ attrLevel(store.s, d.attr) }}</small>
            </td>
            <td style="padding:4px" class="mut">{{ p.iter[d.key] }}/{{ ITER_MAX }} 次</td>
            <td style="padding:4px" class="mut">本次增益 +{{ dimGain(p.themeId, d.key) }}</td>
            <td style="padding:4px;text-align:right">
              <button
                v-if="nextIterCost(p.iter[d.key]) !== null"
                style="padding:2px 10px;font-size:12px"
                :disabled="store.s.designer.inspiration < nextIterCost(p.iter[d.key])!"
                @click="doIterate(p.uid, d.key)"
              >
                打磨 -{{ nextIterCost(p.iter[d.key]) }}💡
              </button>
              <span v-else class="ok" style="font-size:12px">已至极限</span>
            </td>
          </tr>
        </table>
        <div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button style="padding:3px 12px;font-size:12px" @click="launchFor = launchFor === p.uid ? null : p.uid">
            📣 发起众筹…
          </button>
        </div>

        <!-- 发起众筹参数区 -->
        <div v-if="launchFor === p.uid && launchState" style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px">
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px">
            <label>
              目标人数
              <input v-model.number="goalInput" type="number" :min="CROWD_GOAL_MIN" :max="CROWD_GOAL_MAX" style="width:80px" />
              <small class="mut">（{{ CROWD_GOAL_MIN }}~{{ CROWD_GOAL_MAX }}）</small>
            </label>
            <label style="display:flex;gap:6px;align-items:center">
              期限 {{ daysInput }} 天
              <input v-model.number="daysInput" type="range" :min="CROWD_DAYS_MIN" :max="CROWD_DAYS_MAX" style="width:120px" />
              <small class="mut">≈ {{ (daysInput * DAY_SECONDS / 60).toFixed(1) }} 分钟现实时间</small>
            </label>
          </div>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px;margin-top:6px">
            <label style="display:flex;gap:6px;align-items:center">
              定价 {{ ratioPct }}%
              <input v-model.number="ratioPct" type="range" :min="PRICE_RATIO_MIN * 100" :max="PRICE_RATIO_MAX * 100" step="10" style="width:140px" />
            </label>
            <span>成本价 ¥{{ fmt(launchState.costPrice) }} → 售价 <b class="price">¥{{ fmt(launchState.price) }}</b></span>
            <span class="mut">单人购买概率上限 ≈ {{ (launchState.hint * 100).toFixed(0) }}%（题材命中时）</span>
          </div>
          <div style="margin-top:8px">
            <button class="primary" style="padding:4px 16px;font-size:13px" @click="doLaunch(p.uid)">
              📣 确认发起（Q{{ launchState.q }} · {{ rarityOf(launchState.q) }} · 锁定不可迭代）
            </button>
            <button style="margin-left:8px;padding:4px 12px;font-size:13px" @click="launchFor = null">取消</button>
          </div>
        </div>
      </div>

      <!-- 进行中众筹 -->
      <div v-if="store.s.designer.campaigns.length" class="panel" style="margin-bottom:12px">
        <h3 style="margin:0 0 8px">📣 众筹进行中 <small class="mut">1 天 = {{ DAY_SECONDS }} 秒现实时间</small></h3>
        <div v-for="c in store.s.designer.campaigns" :key="c.uid" style="border-top:1px solid var(--line);padding:6px 0">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px">
            <b>《{{ c.name }}》</b>
            <span class="mut">{{ themeById(c.themeId).name }} · {{ scaleById(c.scale).name }}</span>
            <span :class="c.rarity === 'N' ? 'mut' : 'price'">{{ c.rarity }}</span>
            <span style="margin-left:auto">¥{{ fmt(c.price) }}<small class="mut">/份</small></span>
          </div>
          <div class="bar" style="margin-top:4px;height:8px">
            <i :style="{ width: Math.min(100, Math.round((c.supporters / c.goal) * 1000) / 10) + '%' }"></i>
          </div>
          <div class="mut" style="font-size:12px;margin-top:2px">
            {{ c.supporters }}/{{ c.goal }} 人 · 剩 {{ remainingDays(c) }} 天 · 预估收入 ¥{{ fmt(estIncome(c)) }}
          </div>
        </div>
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
            <th style="padding:3px 4px">名称</th><th>稀有度</th><th>Q</th><th>售价</th><th>支持人数</th><th>交付</th>
          </tr>
          <tr v-for="f in store.s.designer.funded" :key="f.uid" style="border-top:1px solid var(--line)">
            <td style="padding:3px 4px">
              《{{ f.name }}》
              <small v-if="!f.delivered" class="warn">待交付</small>
            </td>
            <td>{{ f.rarity }}</td>
            <td>{{ f.score }}</td>
            <td>¥{{ fmt(f.price) }}</td>
            <td>{{ f.supporters }}</td>
            <td style="padding:3px 4px">
              <template v-if="!f.delivered">
                <small class="mut">垫资 ¥{{ fmt(f.cost) }} → 货款 ¥{{ fmt(f.income) }}，</small>
                <small :class="f.income - f.cost >= 0 ? 'ok' : 'bad2'">
                  净{{ f.income - f.cost >= 0 ? '收益' : '亏损' }} ¥{{ fmt(Math.abs(f.income - f.cost)) }}
                </small>
                <button
                  style="margin-left:6px;padding:2px 10px;font-size:12px"
                  :disabled="store.s.money < f.cost"
                  :title="store.s.money < f.cost ? `交付需垫资 ¥${fmt(f.cost)}，资金不足` : ''"
                  @click="store.deliverDesign(f.uid)"
                >
                  📦 交付
                </button>
              </template>
              <small v-else :class="f.income - f.cost >= 0 ? 'ok' : 'bad2'">
                已交付 · 净{{ f.income - f.cost >= 0 ? '收益' : '亏损' }} ¥{{ fmt(Math.abs(f.income - f.cost)) }}
              </small>
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
