<script setup lang="ts">
import type { SchedulerTaskCardView } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  item: SchedulerTaskCardView
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  openDetail: []
}>()

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('select')
  }
}
</script>

<template>
  <n-card
    :bordered="props.selected"
    :embedded="!props.selected"
    size="small"
    hoverable
    tabindex="0"
    role="button"
    @click="emit('select')"
    @keydown="handleKeydown"
  >
    <template #header>
      <n-space align="center" :size="8" :wrap="true">
        <n-text strong>
          {{ props.item.title }}
        </n-text>
        <n-tag round size="small" :type="props.item.statusTag.type">
          {{ props.item.statusTag.label }}
        </n-tag>
        <n-tag v-if="props.selected" round size="small" type="primary">
          已选中
        </n-tag>
      </n-space>
    </template>

    <template #header-extra>
      <n-button tertiary size="small" type="primary" @click.stop="emit('openDetail')">
        详情
      </n-button>
    </template>

    <n-space vertical :size="14">
      <n-text depth="3">
        {{ props.item.subtitle }}
      </n-text>

      <n-space :size="8" :wrap="true">
        <n-tag v-for="tag in props.item.tags.slice(1)" :key="tag.key" round size="small" :type="tag.type">
          {{ tag.label }}
        </n-tag>
      </n-space>

      <n-progress
        v-if="props.item.progress != null"
        type="line"
        :percentage="props.item.progress"
        indicator-placement="inside"
        processing
      />

      <n-descriptions bordered label-placement="top" size="small" :column="2">
        <n-descriptions-item v-for="field in props.item.fields" :key="field.key" :label="field.label">
          <n-ellipsis :tooltip="true">
            {{ field.value }}
          </n-ellipsis>
        </n-descriptions-item>
      </n-descriptions>

      <n-alert :type="props.item.messageType" :show-icon="false">
        <n-ellipsis :tooltip="true" :line-clamp="2">
          {{ props.item.message }}
        </n-ellipsis>
      </n-alert>

      <n-descriptions bordered label-placement="top" size="small" :column="3">
        <n-descriptions-item v-for="timeline in props.item.timeline" :key="timeline.key" :label="timeline.label">
          <n-ellipsis :tooltip="true">
            {{ timeline.value }}
          </n-ellipsis>
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>
