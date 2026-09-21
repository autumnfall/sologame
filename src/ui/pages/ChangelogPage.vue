<script setup lang="ts">
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
    <h2>📝 版本更新</h2>

    <div class="panel" style="margin-bottom:12px">
      当前版本：<b class="price" style="font-size:18px">{{ current }}</b>
      <span class="mut" style="margin-left:8px">每次版本的功能增加、调整与 bug 修复记录如下（新在前）。</span>
    </div>

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
