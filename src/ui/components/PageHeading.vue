<script setup lang="ts">
import UiIcon from './UiIcon.vue';

defineProps<{
  title: string;
  icon: 'work' | 'shop' | 'shelf' | 'challenge' | 'design' | 'prestige' | 'guide' | 'changelog';
}>();
</script>

<template>
  <header class="page-head">
    <div class="page-heading-line"><UiIcon :name="icon" /><h1>{{ title }}</h1></div>
    <p v-if="$slots.default"><slot /></p>
  </header>
</template>
