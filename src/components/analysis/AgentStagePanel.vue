<script setup lang="ts">
import type { AgentStageItem } from '@/types/agent-stages'

const props = defineProps<{
  stages: AgentStageItem[]
}>()

const activeCode = ref<string>('data')

const activeStage = computed(() => {
  return props.stages.find(item => item.code === activeCode.value) || props.stages[0] || null
})

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
  <n-space vertical :size="12">
    <n-grid :cols="24" :x-gap="8" :y-gap="8" responsive="screen">
      <n-grid-item v-for="stage in stages" :key="stage.code" :span="12" :l-span="6">
        <n-card
          size="small"
          class="cursor-pointer"
          :class="activeCode === stage.code ? 'border border-solid border-primary' : ''"
          @click="activeCode = stage.code"
        >
          <n-space vertical :size="6">
            <n-space justify="space-between" align="center">
              <n-text strong>
                {{ stage.title }}
              </n-text>
              <n-tag size="small" :type="statusType(stage.status)">
                {{ statusText(stage.status) }}
              </n-tag>
            </n-space>
            <n-text depth="3">
              {{ stage.summary || '--' }}
            </n-text>
            <n-text depth="3">
              耗时：{{ stage.durationMs != null ? `${stage.durationMs}ms` : '--' }}
            </n-text>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card v-if="activeStage" size="small" title="阶段详情">
      <n-space vertical :size="8">
        <n-alert v-if="activeStage.errorMessage" type="error">
          {{ activeStage.errorMessage }}
        </n-alert>
        <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
          <n-grid-item :span="24" :l-span="12">
            <n-card size="small" title="输入摘要">
              <pre class="whitespace-pre-wrap break-all">{{ pretty(activeStage.input) }}</pre>
            </n-card>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="12">
            <n-card size="small" title="输出摘要">
              <pre class="whitespace-pre-wrap break-all">{{ pretty(activeStage.output) }}</pre>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-space>
    </n-card>
  </n-space>
</template>
