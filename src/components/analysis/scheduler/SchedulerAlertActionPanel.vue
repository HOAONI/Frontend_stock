<script setup lang="ts">
import type { SchedulerAlertItem } from '@/types/analysis-scheduler-view'

defineProps<{
  alerts: SchedulerAlertItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  focusStale: []
  focusFailed: []
  resetFilters: []
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            告警与快捷操作
          </n-text>
          <n-text strong>
            先处理最重要的问题
          </n-text>
        </n-space>
        <n-tag round size="small" type="warning">
          3 条重点提醒
        </n-tag>
      </n-flex>

      <n-space vertical :size="10">
        <n-alert
          v-for="item in alerts"
          :key="item.key"
          :type="item.type"
          :show-icon="false"
        >
          <n-space vertical :size="6">
            <n-text strong>
              {{ item.title }}
            </n-text>
            <n-text depth="3">
              {{ item.content }}
            </n-text>
          </n-space>
        </n-alert>
      </n-space>

      <n-grid cols="2" :x-gap="12" :y-gap="12">
        <n-grid-item>
          <n-button block type="primary" :loading="loading" @click="emit('refresh')">
            刷新全部
          </n-button>
        </n-grid-item>
        <n-grid-item>
          <n-button block secondary type="warning" @click="emit('focusStale')">
            仅看异常
          </n-button>
        </n-grid-item>
        <n-grid-item>
          <n-button block secondary type="error" @click="emit('focusFailed')">
            失败任务
          </n-button>
        </n-grid-item>
        <n-grid-item>
          <n-button block @click="emit('resetFilters')">
            重置筛选
          </n-button>
        </n-grid-item>
      </n-grid>
    </n-space>
  </n-card>
</template>
