<script setup lang="ts">
import { ATTR_ICON, ATTRS } from '../../core';
import type { Attr } from '../../core';

const props = withDefaults(
  defineProps<{ modelValue: Attr | null; tiredOnly?: boolean; unmasteredOnly?: boolean }>(),
  { tiredOnly: false, unmasteredOnly: false },
);
const emit = defineEmits<{
  'update:modelValue': [value: Attr | null];
  'update:tiredOnly': [value: boolean];
  'update:unmasteredOnly': [value: boolean];
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
      title="只看疲劳≥7（玩腻了）的收藏，可与属性筛选叠加"
      :style="chipStyle(props.tiredOnly)"
      @click="emit('update:tiredOnly', !props.tiredOnly)"
    >
      😩 玩腻了的
    </button>
    <button
      style="padding:3px 10px;font-size:12px"
      title="只看尚未精通的收藏，可与属性筛选叠加"
      :style="chipStyle(props.unmasteredOnly)"
      @click="emit('update:unmasteredOnly', !props.unmasteredOnly)"
    >
      ⭐ 未精通
    </button>
  </div>
</template>
