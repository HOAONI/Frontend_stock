<script setup lang="ts">
// 调度中心顶部概览面板负责展示当前视角的核心指标和摘要。
import type {
  SchedulerHeroView,
  SchedulerMetricItem,
} from '@/types/analysis-scheduler-view'

const props = defineProps<{
  view: SchedulerHeroView
  metrics: SchedulerMetricItem[]
}>()

const displayMetrics = computed(() => props.metrics.slice(0, 4))
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="8">
          <n-space :size="8" align="center" :wrap="true">
            <n-text depth="3">
              调度总览
            </n-text>
            <n-tag round size="small" type="info">
              {{ props.view.scopeLabel }}
            </n-tag>
          </n-space>

          <n-space vertical :size="8">
            <n-text strong>
              调度中心总控视图
            </n-text>
            <n-alert type="info" :show-icon="false">
              {{ props.view.summary }}
            </n-alert>
          </n-space>
        </n-space>

        <n-tag round size="small">
          概览更新时间：{{ props.view.updatedAt }}
        </n-tag>
      </n-flex>

      <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="item in displayMetrics" :key="item.key">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                <n-text strong>
                  {{ item.label }}
                </n-text>
                <n-tag round size="small" :type="item.type">
                  摘要
                </n-tag>
              </n-flex>
              <n-statistic :value="item.value" />
              <n-text depth="3">
                {{ item.hint }}
              </n-text>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-space>
  </n-card>
</template>
