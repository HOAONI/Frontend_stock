<script setup lang="ts">
import type {
  SchedulerActionState,
  SchedulerFieldItem,
  SchedulerMetricItem,
  SchedulerTagItem,
} from '@/types/analysis-scheduler-view'

const props = defineProps<{
  hasTask: boolean
  metrics: SchedulerMetricItem[]
  summary: string
  headerTag: SchedulerTagItem | null
  tags: SchedulerTagItem[]
  fields: SchedulerFieldItem[]
  progress: number | null
  actionState: SchedulerActionState
  showPriorityAction: boolean
}>()

const emit = defineEmits<{
  viewDetail: []
  retry: []
  rerun: []
  cancel: []
  adjustPriority: []
  clearSelection: []
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            我的待办
          </n-text>
          <n-text strong>
            当前关注与任务动作
          </n-text>
        </n-space>

        <n-tag
          v-if="props.headerTag"
          round
          size="small"
          :type="props.headerTag.type"
        >
          {{ props.headerTag.label }}
        </n-tag>
        <n-tag v-else round size="small">
          未选中
        </n-tag>
      </n-flex>

      <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="item in props.metrics" :key="item.key">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                <n-text strong>
                  {{ item.label }}
                </n-text>
                <n-tag round size="small" :type="item.type">
                  关注
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

      <n-alert :type="props.hasTask ? 'info' : 'warning'" :show-icon="false">
        {{ props.summary }}
      </n-alert>

      <n-space v-if="props.tags.length" :size="8" :wrap="true">
        <n-tag v-for="item in props.tags" :key="item.key" round size="small" :type="item.type">
          {{ item.label }}
        </n-tag>
      </n-space>

      <n-progress
        v-if="props.progress != null"
        type="line"
        :percentage="props.progress"
        indicator-placement="inside"
        processing
      />

      <n-descriptions
        v-if="props.fields.length"
        bordered
        label-placement="top"
        size="small"
        :column="2"
      >
        <n-descriptions-item v-for="item in props.fields" :key="item.key" :label="item.label">
          <n-ellipsis :tooltip="true">
            {{ item.value }}
          </n-ellipsis>
        </n-descriptions-item>
      </n-descriptions>

      <n-empty
        v-else
        size="small"
        description="从下方任务区选择一条任务后，这里会显示摘要与操作按钮。"
      />

      <n-flex :size="[8, 8]" :wrap="true">
        <n-button :disabled="!props.hasTask" @click="emit('viewDetail')">
          查看详情
        </n-button>
        <n-button type="warning" :disabled="!props.actionState.canRetry" @click="emit('retry')">
          重试
        </n-button>
        <n-button type="primary" secondary :disabled="!props.actionState.canRerun" @click="emit('rerun')">
          重跑
        </n-button>
        <n-button type="error" secondary :disabled="!props.actionState.canCancel" @click="emit('cancel')">
          取消
        </n-button>
        <n-button
          v-if="props.showPriorityAction"
          secondary
          :disabled="!props.actionState.canAdjustPriority"
          @click="emit('adjustPriority')"
        >
          调整优先级
        </n-button>
        <n-button tertiary size="small" :disabled="!props.hasTask" @click="emit('clearSelection')">
          取消选中
        </n-button>
      </n-flex>
    </n-space>
  </n-card>
</template>
