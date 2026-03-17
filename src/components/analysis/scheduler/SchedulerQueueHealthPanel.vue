<script setup lang="ts">
// 调度中心队列健康面板负责展示队列积压、执行延迟和处理趋势。
import type {
  SchedulerMetricItem,
  SchedulerQueuePreviewItem,
} from '@/types/analysis-scheduler-view'

defineProps<{
  summary: string
  metrics: SchedulerMetricItem[]
  items: SchedulerQueuePreviewItem[]
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            队列健康
          </n-text>
          <n-text strong>
            当前压力与优先处理项
          </n-text>
        </n-space>
        <n-text depth="3">
          {{ summary }}
        </n-text>
      </n-flex>

      <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="item in metrics" :key="item.key">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                <n-text strong>
                  {{ item.label }}
                </n-text>
                <n-tag round size="small" :type="item.type">
                  队列
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

      <n-space vertical :size="10">
        <n-text depth="3">
          当前队列前排任务
        </n-text>

        <n-empty v-if="!items.length" size="small" description="当前筛选条件下暂无可展示的队列任务" />

        <template v-else>
          <n-card
            v-for="item in items"
            :key="item.key"
            embedded
            size="small"
            :bordered="false"
          >
            <n-flex justify="space-between" align="start" :wrap="true" :size="12">
              <n-space vertical :size="6">
                <n-space align="center" :size="8" :wrap="true">
                  <n-text strong>
                    {{ item.stockCode }}
                  </n-text>
                  <n-tag round size="small" :type="item.statusTag.type">
                    {{ item.statusTag.label }}
                  </n-tag>
                </n-space>
                <n-text depth="3">
                  {{ item.ownerLabel }}
                </n-text>
              </n-space>

              <n-space vertical :size="6" align="end">
                <n-tag round size="small">
                  优先级 {{ item.priority }}
                </n-tag>
                <n-text depth="3">
                  {{ item.progressLabel }}
                </n-text>
              </n-space>
            </n-flex>
          </n-card>
        </template>
      </n-space>
    </n-space>
  </n-card>
</template>
