<script setup lang="ts">
import type {
  SchedulerFieldItem,
  SchedulerHealthItem,
} from '@/types/analysis-scheduler-view'

const props = defineProps<{
  workerHealthy: boolean
  summary: string
  items: SchedulerHealthItem[]
  metaItems: SchedulerFieldItem[]
}>()

const serviceItems = computed(() => props.items.slice(0, 4))
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            健康状态
          </n-text>
          <n-text strong>
            Worker 与代理服务
          </n-text>
        </n-space>
        <n-tag round size="small" :type="props.workerHealthy ? 'success' : 'error'">
          {{ props.workerHealthy ? '运行正常' : '需要排查' }}
        </n-tag>
      </n-flex>

      <n-alert :type="props.workerHealthy ? 'success' : 'warning'" :show-icon="false">
        {{ props.summary }}
      </n-alert>

      <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="item in serviceItems" :key="item.key">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                <n-text strong>
                  {{ item.label }}
                </n-text>
                <n-tag round size="small" :type="item.ok ? 'success' : 'error'">
                  {{ item.ok ? '正常' : '异常' }}
                </n-tag>
              </n-flex>
              <n-statistic :value="item.ok ? '正常' : '异常'" />
              <n-text depth="3">
                {{ item.hint }}
              </n-text>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>

      <n-descriptions bordered label-placement="top" size="small" :column="2">
        <n-descriptions-item v-for="item in props.metaItems" :key="item.key" :label="item.label">
          <n-ellipsis :tooltip="true">
            {{ item.value }}
          </n-ellipsis>
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>
