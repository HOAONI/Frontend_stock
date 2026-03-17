<script setup lang="ts">
// Agent 阶段面板负责展示单条分析结果的阶段状态、摘要和原始输出。
import type { AgentStageItem } from '@/types/agent-stages'

const props = defineProps<{
  stages: AgentStageItem[]
}>()

const activeCode = ref<string>('data')

function statusType(status: AgentStageItem['status']) {
  if (status === 'done')
    return 'success'
  if (status === 'failed')
    return 'error'
  return 'warning'
}

function statusText(status: AgentStageItem['status']) {
  if (status === 'done')
    return '完成'
  if (status === 'failed')
    return '失败'
  return '等待'
}

function summaryType(status: AgentStageItem['status']) {
  if (status === 'done')
    return 'success'
  if (status === 'failed')
    return 'error'
  return 'warning'
}

function pretty(value: unknown): string {
  if (value == null)
    return '--'
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

watch(() => props.stages, (list) => {
  if (list.length === 0)
    return
  if (!list.find(item => item.code === activeCode.value))
    activeCode.value = list[0].code
}, { immediate: true })
</script>

<template>
  <n-empty v-if="!props.stages.length" description="暂无阶段详情" />

  <n-tabs v-else v-model:value="activeCode" type="segment" animated>
    <n-tab-pane
      v-for="stage in props.stages"
      :key="stage.code"
      :name="stage.code"
      :tab="stage.title"
    >
      <n-space vertical :size="12">
        <n-flex justify="space-between" align="start" :wrap="true" :size="12">
          <n-space :size="8" align="center" :wrap="true">
            <n-tag round size="small" :type="statusType(stage.status)">
              {{ statusText(stage.status) }}
            </n-tag>
            <n-text depth="3">
              耗时：{{ stage.durationMs != null ? `${stage.durationMs} ms` : '--' }}
            </n-text>
          </n-space>
          <n-text depth="3">
            {{ stage.title }}
          </n-text>
        </n-flex>

        <n-alert :type="summaryType(stage.status)" :show-icon="false">
          {{ stage.summary || '--' }}
        </n-alert>

        <n-alert v-if="stage.errorMessage" type="error" :show-icon="false">
          {{ stage.errorMessage }}
        </n-alert>

        <n-grid cols="1 l:2" responsive="screen" :x-gap="12" :y-gap="12">
          <n-grid-item>
            <n-card embedded size="small" :bordered="false" title="输入摘要">
              <n-code word-wrap>
                {{ pretty(stage.input) }}
              </n-code>
            </n-card>
          </n-grid-item>
          <n-grid-item>
            <n-card embedded size="small" :bordered="false" title="输出摘要">
              <n-code word-wrap>
                {{ pretty(stage.output) }}
              </n-code>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-space>
    </n-tab-pane>
  </n-tabs>
</template>
