<script setup lang="ts">
import tabletop from '../assets/tabletop.webp';
import UiIcon from './UiIcon.vue';

defineProps<{ count: number; total: number; hasGames: boolean }>();
defineEmits<{ action: [] }>();
</script>

<template>
  <section class="desk-hero" aria-labelledby="desk-title">
    <img :src="tabletop" class="desk-hero-image" alt="" fetchpriority="high" />
    <div class="desk-hero-copy">
      <p class="desk-kicker"><span aria-hidden="true"></span> 我的桌游空间</p>
      <h1 id="desk-title">桌游收藏家</h1>
      <p class="desk-description">从第一盒桌游开始，慢慢填满你的收藏架。</p>
      <button type="button" class="primary hero-action" @click="$emit('action')">
        {{ hasGames ? '挑一盒开玩' : '逛逛商店' }} <UiIcon name="arrow" />
      </button>
    </div>
    <div class="hero-collection">
      <UiIcon name="shelf" />
      <span>图鉴收藏 <b>{{ count }}<small> / {{ total }}</small></b></span>
    </div>
  </section>
</template>
