<script setup lang="ts">
const paths = {
  play: 'M12 2.8 21 8v8l-9 5.2L3 16V8l9-5.2ZM3 8l9 5.2L21 8m-9 5.2v8M7.5 5.4l9 5.2',
  work: 'M4 7h16a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1Zm4 0V4h8v3M3 12h18m-11 0v2h4v-2',
  shop: 'M3 4h2l2.4 11h10.9L21 7H6m3 12h.01M18 19h.01M10 19a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  shelf: 'M4 4h4v15H4zm4 2h4v13H8zm5 0 4-1 4 13-4 1zM2 21h20',
  challenge: 'M8 21h8m-4 0v-5M7 4h10v6a5 5 0 0 1-10 0V4Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4',
  design: 'm14 5 5 5M4 20l1-5L16 4a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L9 19l-5 1Z',
  prestige: 'M3 19h18M5 15h14m-12 0a5 5 0 0 1 10 0m-5-11v3m-7 1 2 2m12-2-2 2',
  guide: 'M12 6v14m0-14C8 3 5 3 3 4v14c4-1 7 0 9 2 2-2 5-3 9-2V4c-2-1-5-1-9 2Z',
  changelog: 'M7 3h7l5 5v13H5V3h2Zm7 0v6h5M8 13h8m-8 4h8',
  more: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  money: 'M12 3C7 3 3 5 3 8s4 5 9 5 9-2 9-5-4-5-9-5ZM3 8v4c0 3 4 5 9 5s9-2 9-5V8M3 12v4c0 3 4 5 9 5s9-2 9-5v-4',
  sleeves: 'M8 3h10a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-5 6v10a2 2 0 0 0 2 2h11m-3-14 3 4-3 4-3-4 3-4Z',
  ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 0v2m0 3v2m0 3v2',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm6 9 6 6 6-6',
} as const;

defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg class="ui-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
