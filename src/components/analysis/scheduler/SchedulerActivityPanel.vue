<script setup lang="ts">
// 调度中心活动面板负责展示近期任务动态和关键时间线。
import type { SchedulerActivityItem } from '@/types/analysis-scheduler-view'

defineProps<{
  items: SchedulerActivityItem[]
  focusedTaskLabel: string | null
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            队列动态
          </n-text>
          <n-text strong>
            时间线追踪
          </n-text>
        </n-space>
        <n-tag round size="small" :type="focusedTaskLabel ? 'primary' : 'info'">
          {{ focusedTaskLabel ? '任务聚焦' : '队列视图' }}
        </n-tag>
      </n-flex>

      <n-alert v-if="focusedTaskLabel" type="info" :show-icon="false">
        当前聚焦：{{ focusedTaskLabel }}
      </n-alert>
      <n-text v-else depth="3">
        未选中任务时，默认展示当前页前五条任务的最新动态。
      </n-text>

      <n-timeline v-if="items.length">
        <n-timeline-item
          v-for="item in items"
          :key="item.key"
          :type="item.type"
          :title="item.title"
          :content="item.content"
          :time="item.time"
        />
      </n-timeline>

      <n-empty v-else description="暂无动态数据" />
    </n-space>
  </n-card>
</template>
