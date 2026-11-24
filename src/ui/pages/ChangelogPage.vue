<script setup lang="ts">
import PageHeading from '../components/PageHeading.vue';
import { CHANGELOG } from '../../core';
import type { ChangelogEntry } from '../../core';

const current = CHANGELOG[0].version;

const SECTION_META: { key: keyof ChangelogEntry['sections']; icon: string; label: string }[] = [
  { key: 'feat', icon: '✨', label: '新增' },
  { key: 'adjust', icon: '🔧', label: '调整' },
  { key: 'fix', icon: '🩹', label: '修复' },
];
</script>

<template>
  <div>
    <PageHeading icon="changelog" title="版本更新" />


    <div v-for="e in CHANGELOG" :key="e.version" class="panel" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
        <b style="font-size:15px">{{ e.version }}</b>
        <small class="mut">{{ e.date }}</small>
        <small v-if="e.version === current" class="ok">（当前版本）</small>
      </div>
      <div v-for="sec in SECTION_META" :key="sec.key" style="margin-top:8px">
        <template v-if="e.sections[sec.key]?.length">
          <b style="font-size:12px">{{ sec.icon }} {{ sec.label }}</b>
          <ul style="margin:4px 0 0;padding-left:20px;font-size:12px;line-height:1.8">
            <li v-for="(line, i) in e.sections[sec.key]" :key="i">{{ line }}</li>
          </ul>
        </template>
      </div>
    </div>
  </div>
</template>
