<script setup lang="ts">
import type { SchedulerScope } from '@/types/analysis-scheduler'
import type { SchedulerHeroView } from '@/types/analysis-scheduler-view'

defineProps<{
  view: SchedulerHeroView
}>()

const emit = defineEmits<{
  'refresh': []
  'update:scope': [value: SchedulerScope]
}>()
</script>

<template>
  <n-card :bordered="false" size="small" class="scheduler-panel-card">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="8" style="min-width: 0;">
          <n-space :size="8" align="center" :wrap="true">
            <n-tag round size="small" type="info">
              调度总控
            </n-tag>
            <n-text depth="3">
              当前视图：{{ view.scopeLabel }}
            </n-text>
          </n-space>
          <n-space vertical :size="8">
            <n-text tag="h2" class="scheduler-panel-title">
              AI 分析与调度 · 调度中心
            </n-text>
            <n-text depth="3">
              {{ view.summary }}
            </n-text>
          </n-space>
        </n-space>

        <n-space vertical align="end" :size="6">
          <n-text depth="3">
            概览更新时间：{{ view.updatedAt }}
          </n-text>
          <n-button tertiary size="small" :loading="view.loading" @click="emit('refresh')">
            刷新全部
          </n-button>
        </n-space>
      </n-flex>

      <n-radio-group
        v-if="view.isAdmin"
        :value="view.scope"
        size="small"
        @update:value="emit('update:scope', $event)"
      >
        <n-radio-button v-for="item in view.scopeOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </n-radio-button>
      </n-radio-group>

      <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
        <n-grid-item v-for="item in view.highlights" :key="item.key" :span="24" :m-span="12">
          <n-card embedded size="small" :bordered="false">
            <n-statistic :label="item.label" :value="item.value" />
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-space>
  </n-card>
</template>

<style scoped>
.scheduler-panel-card {
  height: 100%;
}

.scheduler-panel-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.1;
  font-weight: 700;
}

@media (max-width: 767px) {
  .scheduler-panel-title {
    font-size: 24px;
  }
}
</style>
