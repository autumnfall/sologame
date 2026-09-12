<script setup lang="ts">
import { ATTR_ICON, ATTRS, TIER_ORDER } from '../../core';
import type { Attr, Rarity } from '../../core';

const props = withDefaults(
  defineProps<{
    modelValue: Attr | null;
    notTiredOnly?: boolean;
    unmasteredOnly?: boolean;
    /** 收藏架用：只看已精通（不传则不显示该筛选） */
    masteredOnly?: boolean;
    /** 收藏架用：稀有度筛选（null = 全部；不传则不显示） */
    rarity?: Rarity | null;
    /** 收藏架用：价值排序（不传则不显示排序框） */
    sort?: 'default' | 'valueAsc' | 'valueDesc';
  }>(),
  { notTiredOnly: false, unmasteredOnly: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: Attr | null];
  'update:notTiredOnly': [value: boolean];
  'update:unmasteredOnly': [value: boolean];
  'update:masteredOnly': [value: boolean];
  'update:rarity': [value: Rarity | null];
  'update:sort': [value: 'default' | 'valueAsc' | 'valueDesc'];
}>();

function chipStyle(on: boolean): Record<string, string> {
  return on ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {};
}
</script>

<template>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
    <button
      style="padding:3px 10px;font-size:12px"
      :style="chipStyle(props.modelValue === null)"
      @click="emit('update:modelValue', null)"
    >
      全部
    </button>
    <button
      v-for="a in ATTRS"
      :key="a"
      style="padding:3px 10px;font-size:12px"
      :style="chipStyle(props.modelValue === a)"
      @click="emit('update:modelValue', a)"
    >
      {{ ATTR_ICON[a] }}{{ a }}
    </button>
    <span style="width:1px;height:16px;background:var(--line);margin:0 4px"></span>
    <button
      style="padding:3px 10px;font-size:12px"
      title="只看未玩腻（疲劳<7）的收藏，可与属性筛选叠加"
      :style="chipStyle(props.notTiredOnly)"
      @click="emit('update:notTiredOnly', !props.notTiredOnly)"
    >
      😌 未玩腻的
    </button>
    <button
      style="padding:3px 10px;font-size:12px"
      title="只看尚未精通的收藏，可与属性筛选叠加"
      :style="chipStyle(props.unmasteredOnly)"
      @click="emit('update:unmasteredOnly', !props.unmasteredOnly)"
    >
      ⭐ 未精通
    </button>
    <button
      v-if="props.masteredOnly !== undefined"
      style="padding:3px 10px;font-size:12px"
      title="只看已精通的收藏，方便批量出二手"
      :style="chipStyle(props.masteredOnly)"
      @click="emit('update:masteredOnly', !props.masteredOnly)"
    >
      🏆 已精通
    </button>
    <template v-if="props.rarity !== undefined">
      <span style="width:1px;height:16px;background:var(--line);margin:0 4px"></span>
      <button
        style="padding:3px 10px;font-size:12px"
        :style="chipStyle(props.rarity === null)"
        @click="emit('update:rarity', null)"
      >
        全稀有度
      </button>
      <button
        v-for="r in TIER_ORDER"
        :key="r"
        style="padding:3px 10px;font-size:12px"
        :style="chipStyle(props.rarity === r)"
        @click="emit('update:rarity', r)"
      >
        {{ r }}
      </button>
    </template>
    <select
      v-if="props.sort !== undefined"
      :value="props.sort"
      title="按桌游本身价值（市价）排序"
      style="margin-left:auto;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:3px 6px;font-size:12px"
      @change="emit('update:sort', ($event.target as HTMLSelectElement).value as 'default' | 'valueAsc' | 'valueDesc')"
    >
      <option value="default">默认排序</option>
      <option value="valueDesc">价值 高→低</option>
      <option value="valueAsc">价值 低→高</option>
    </select>
  </div>
</template>
