<script setup lang="ts">
import SchedulerTaskDetailDrawer from '@/components/analysis/scheduler/SchedulerTaskDetailDrawer.vue'
import SchedulerTaskFormCard from '@/components/analysis/scheduler/SchedulerTaskFormCard.vue'
import SchedulerTaskTableCard from '@/components/analysis/scheduler/SchedulerTaskTableCard.vue'
import { useSchedulerCenter } from '@/composables/useSchedulerCenter'
import { GRID_GAP } from '@/constants/design-tokens'

const {
  detail,
  detailLoading,
  detailVisible,
  dueSoonCount,
  editingSchedule,
  enabledCount,
  executionModeOptions,
  form,
  handleDelete,
  handleToggle,
  loading,
  pausedCount,
  processingCount,
  refreshDetail,
  refreshSchedules,
  rowActionId,
  saving,
  schedules,
  startCreate,
  startEdit,
  submitForm,
} = useSchedulerCenter()

const stats = computed(() => [
  { key: 'enabled', label: '启用中任务', value: enabledCount.value, type: 'success' as const },
  { key: 'paused', label: '暂停任务', value: pausedCount.value, type: 'default' as const },
  { key: 'processing', label: '最近执行中', value: processingCount.value, type: 'info' as const },
  { key: 'due-soon', label: '5 分钟内触发', value: dueSoonCount.value, type: 'warning' as const },
])

function openDetail(scheduleId: string) {
  void refreshDetail(scheduleId, { openDrawer: true })
}
</script>

<template>
  <n-layout embedded>
    <n-space vertical :size="GRID_GAP.outer">
      <n-card :bordered="false" size="small" class="schedule-page__hero">
        <n-flex justify="space-between" align="start" :wrap="true" :size="16">
          <n-space vertical :size="10">
            <n-breadcrumb>
              <n-breadcrumb-item>
                AI 分析与调度
              </n-breadcrumb-item>
              <n-breadcrumb-item>
                调度中心
              </n-breadcrumb-item>
            </n-breadcrumb>

            <div class="schedule-page__title">
              调度中心
            </div>
            <div class="schedule-page__desc">
              在这里为股票绑定周期性分析任务。系统会按分钟周期自动入队分析，不再依赖分析中心手动触发。
            </div>
          </n-space>

          <n-button tertiary type="primary" :loading="loading" @click="refreshSchedules()">
            刷新全部
          </n-button>
        </n-flex>
      </n-card>

      <n-grid :cols="24" responsive="screen" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer">
        <n-grid-item
          v-for="item in stats"
          :key="item.key"
          :span="24"
          :m-span="12"
          :l-span="6"
        >
          <n-card :bordered="false" size="small">
            <n-statistic :label="item.label" :value="item.value">
              <template #prefix>
                <n-tag round size="small" :type="item.type">
                  {{ item.label }}
                </n-tag>
              </template>
            </n-statistic>
          </n-card>
        </n-grid-item>

        <n-grid-item :span="24" :l-span="8">
          <SchedulerTaskFormCard
            v-model:form="form"
            :editing-schedule="editingSchedule"
            :saving="saving"
            :mode-options="executionModeOptions"
            @submit="submitForm"
            @cancel-edit="startCreate"
          />
        </n-grid-item>

        <n-grid-item :span="24" :l-span="16">
          <SchedulerTaskTableCard
            :schedules="schedules"
            :loading="loading"
            :row-action-id="rowActionId"
            @refresh="refreshSchedules()"
            @view="openDetail($event.scheduleId)"
            @edit="startEdit"
            @toggle="handleToggle($event.schedule, $event.enabled)"
            @delete="handleDelete"
          />
        </n-grid-item>
      </n-grid>
    </n-space>

    <SchedulerTaskDetailDrawer
      v-model:show="detailVisible"
      :loading="detailLoading"
      :detail="detail"
    />
  </n-layout>
</template>

<style scoped>
.schedule-page__hero {
  overflow: hidden;
}

.schedule-page__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--n-text-color);
}

.schedule-page__desc {
  max-width: 720px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--n-text-color-3);
}
</style>
