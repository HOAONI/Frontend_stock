<script setup lang="ts">
import SchedulerTaskQueueCard from '@/components/analysis/scheduler/SchedulerTaskQueueCard.vue'
import type { SchedulerSpotlightTaskItem } from '@/types/analysis-scheduler-view'

defineProps<{
  loading: boolean
  summary: string
  items: SchedulerSpotlightTaskItem[]
}>()

const emit = defineEmits<{
  selectTask: [taskId: string]
  openDetail: [taskId: string]
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            队列 Spotlight
          </n-text>
          <n-text strong>
            不规则任务拼图
          </n-text>
        </n-space>
        <n-text depth="3">
          {{ summary }}
        </n-text>
      </n-flex>

      <n-text depth="3">
        前四条任务按照便当盒节奏排布，保留状态、优先级、时间线与详情入口。
      </n-text>

      <n-spin :show="loading">
        <n-grid v-if="items.length" cols="1 s:2 l:6" responsive="screen" :x-gap="12" :y-gap="12">
          <n-grid-item
            v-for="item in items"
            :key="item.key"
            :span="item.span"
            :s-span="item.sSpan"
            :l-span="item.lSpan"
          >
            <SchedulerTaskQueueCard
              :item="item.card"
              :selected="item.selected"
              @select="emit('selectTask', item.card.task.taskId)"
              @open-detail="emit('openDetail', item.card.task.taskId)"
            />
          </n-grid-item>
        </n-grid>

        <n-empty v-else description="当前筛选条件下暂无调度任务" />
      </n-spin>
    </n-space>
  </n-card>
</template>
