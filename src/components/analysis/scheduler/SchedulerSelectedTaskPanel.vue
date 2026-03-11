<script setup lang="ts">
import type {
  SchedulerActionState,
  SchedulerFieldItem,
  SchedulerTagItem,
} from '@/types/analysis-scheduler-view'

const props = defineProps<{
  hasTask: boolean
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
  <n-card :bordered="false" size="small" class="scheduler-panel-card">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            当前选中任务
          </n-text>
          <n-text strong>
            任务动作工作台
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
          <span class="scheduler-break-all">{{ item.value }}</span>
        </n-descriptions-item>
      </n-descriptions>
      <n-empty
        v-else
        size="small"
        description="从下方任务队列中选择一条任务后，这里会显示摘要与操作按钮。"
      />

      <n-space :size="8" :wrap="true">
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
      </n-space>
    </n-space>
  </n-card>
</template>

<style scoped>
.scheduler-panel-card {
  height: 100%;
}

.scheduler-break-all {
  word-break: break-all;
}
</style>
