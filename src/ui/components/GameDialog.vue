<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ label: string; dismissible?: boolean }>();
const emit = defineEmits<{ dismiss: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);

onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => dialog.value?.close());

function dismissOnBackdrop(event: MouseEvent) {
  const element = dialog.value;
  if (!element || event.target !== element) return;
  const bounds = element.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) emit('dismiss');
}
</script>

<template>
  <dialog ref="dialog" class="game-dialog" :aria-label="label"
    @cancel.prevent="dismissible && $emit('dismiss')" @click="dismissible && dismissOnBackdrop($event)">
    <slot />
  </dialog>
</template>
