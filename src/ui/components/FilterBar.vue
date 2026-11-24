<script setup lang="ts">
import { ATTR_ICON, ATTRS, TIER_ORDER } from '../../core';
import type { Attr, Rarity } from '../../core';

const props = withDefaults(defineProps<{
  modelValue: Attr | null;
  notTiredOnly?: boolean;
  unmasteredOnly?: boolean;
  /** 收藏架用：只看已精通（不传则不显示该筛选） */
  masteredOnly?: boolean;
  /** 收藏架用：只看当前拥有实体的收藏（不传则不显示） */
  ownedOnly?: boolean;
  /** 收藏架用：稀有度筛选（null = 全部；不传则不显示） */
  rarity?: Rarity | null;
  /** 收藏架用：排序（不传则不显示排序框） */
  sort?: 'default' | 'valueAsc' | 'valueDesc' | 'copiesDesc';
}>(), {
  notTiredOnly: undefined,
  unmasteredOnly: undefined,
  masteredOnly: undefined,
  ownedOnly: undefined,
});
const emit = defineEmits<{
  'update:modelValue': [value: Attr | null];
  'update:notTiredOnly': [value: boolean];
  'update:unmasteredOnly': [value: boolean];
  'update:masteredOnly': [value: boolean];
  'update:ownedOnly': [value: boolean];
  'update:rarity': [value: Rarity | null];
  'update:sort': [value: 'default' | 'valueAsc' | 'valueDesc' | 'copiesDesc'];
}>();

</script>

<template>
  <div class="filter-bar" role="group" aria-label="筛选桌游">
    <button
      :aria-pressed="props.modelValue === null"
      @click="emit('update:modelValue', null)"
    >
      全部
    </button>
    <button
      v-for="a in ATTRS"
      :key="a"
      :aria-pressed="props.modelValue === a"
      @click="emit('update:modelValue', a)"
    >
      {{ ATTR_ICON[a] }}{{ a }}
    </button>
    <span class="filter-divider" aria-hidden="true"></span>
    <button
      v-if="props.notTiredOnly !== undefined"
      title="只看未玩腻（疲劳<7）的收藏，可与属性筛选叠加"
      :aria-pressed="props.notTiredOnly"
      @click="emit('update:notTiredOnly', !props.notTiredOnly)"
    >
      😌 未玩腻的
    </button>
    <button
      v-if="props.unmasteredOnly !== undefined"
      title="只看尚未精通的收藏，可与属性筛选叠加"
      :aria-pressed="props.unmasteredOnly"
      @click="emit('update:unmasteredOnly', !props.unmasteredOnly)"
    >
      ⭐ 未精通
    </button>
    <button
      v-if="props.masteredOnly !== undefined"
      title="只看已精通的收藏，方便批量出二手"
      :aria-pressed="props.masteredOnly"
      @click="emit('update:masteredOnly', !props.masteredOnly)"
    >
      🏆 已精通
    </button>
    <button
      v-if="props.ownedOnly !== undefined"
      title="只看当前拥有实体的收藏（实体卖光的不显示）"
      :aria-pressed="props.ownedOnly"
      @click="emit('update:ownedOnly', !props.ownedOnly)"
    >
      📦 已拥有
    </button>
    <template v-if="props.rarity !== undefined">
      <span class="filter-divider" aria-hidden="true"></span>
      <button
        :aria-pressed="props.rarity === null"
        @click="emit('update:rarity', null)"
      >
        全稀有度
      </button>
      <button
        v-for="r in TIER_ORDER"
        :key="r"
        :aria-pressed="props.rarity === r"
        @click="emit('update:rarity', r)"
      >
        {{ r }}
      </button>
    </template>
    <select
      v-if="props.sort !== undefined"
      :value="props.sort"
      title="按桌游本身价值（市价）排序"
      aria-label="排序方式"
      @change="emit('update:sort', ($event.target as HTMLSelectElement).value as 'default' | 'valueAsc' | 'valueDesc' | 'copiesDesc')"
    >
      <option value="default">默认排序</option>
      <option value="valueDesc">价值 高→低</option>
      <option value="valueAsc">价值 低→高</option>
      <option value="copiesDesc">实体数量 多→少</option>
    </select>
  </div>
</template>
