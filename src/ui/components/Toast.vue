<script setup lang="ts">
import { useGameStore } from '../stores/game';

const store = useGameStore();
</script>

<template>
  <div v-if="store.toastOn" id="toast">{{ store.toastMsg }}</div>
</template>
