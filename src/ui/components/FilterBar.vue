<script setup lang="ts">
import { ATTR_ICON, ATTRS } from '../../core';
import type { Attr } from '../../core';

defineProps<{ modelValue: Attr | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: Attr | null] }>();
</script>

<template>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <button
      style="padding:3px 10px;font-size:12px"
      :style="modelValue === null ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}"
      @click="emit('update:modelValue', null)"
    >
      全部
    </button>
    <button
      v-for="a in ATTRS"
      :key="a"
      style="padding:3px 10px;font-size:12px"
      :style="modelValue === a ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}"
      @click="emit('update:modelValue', a)"
    >
      {{ ATTR_ICON[a] }}{{ a }}
    </button>
  </div>
</template>
