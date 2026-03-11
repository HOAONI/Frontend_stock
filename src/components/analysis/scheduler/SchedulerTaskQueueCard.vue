<script setup lang="ts">
import { useThemeVars } from 'naive-ui'
import type { CSSProperties } from 'vue'
import type { SchedulerTaskCardView } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  item: SchedulerTaskCardView
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  openDetail: []
}>()

const themeVars = useThemeVars()

const cardStyle = computed<CSSProperties>(() => {
  if (!props.selected)
    return {}
  return {
    borderColor: themeVars.value.primaryColorSuppl,
    boxShadow: `0 0 0 1px ${themeVars.value.primaryColorSuppl}`,
  }
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('select')
  }
}
</script>

<template>
  <n-card
    embedded
    size="small"
    hoverable
    :bordered="true"
    class="scheduler-task-card"
    :class="{ 'scheduler-task-card--selected': props.selected }"
    :style="cardStyle"
    tabindex="0"
    role="button"
    @click="emit('select')"
    @keydown="handleKeydown"
  >
    <n-space vertical :size="14">
      <n-thing>
        <template #header>
          {{ props.item.title }}
        </template>
        <template #description>
          {{ props.item.subtitle }}
        </template>
        <template #header-extra>
          <n-button tertiary size="small" type="primary" @click.stop="emit('openDetail')">
            详情
          </n-button>
        </template>
      </n-thing>

      <n-space :size="8" :wrap="true">
        <n-tag round size="small" :type="props.item.statusTag.type">
          {{ props.item.statusTag.label }}
        </n-tag>
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
          <span class="scheduler-break-all">{{ field.value }}</span>
        </n-descriptions-item>
      </n-descriptions>

      <n-alert :type="props.item.messageType" :show-icon="false">
        {{ props.item.message }}
      </n-alert>

      <n-descriptions bordered label-placement="top" size="small" :column="3">
        <n-descriptions-item v-for="timeline in props.item.timeline" :key="timeline.key" :label="timeline.label">
          <span class="scheduler-break-all">{{ timeline.value }}</span>
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>

<style scoped>
.scheduler-task-card {
  height: 100%;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.scheduler-task-card:hover,
.scheduler-task-card:focus-visible {
  transform: translateY(-2px);
}

.scheduler-task-card--selected {
  transform: translateY(-2px);
}

.scheduler-break-all {
  word-break: break-all;
}
</style>
