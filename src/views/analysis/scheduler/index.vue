<script setup lang="ts">
import SchedulerActivityPanel from '@/components/analysis/scheduler/SchedulerActivityPanel.vue'
import SchedulerAlertActionPanel from '@/components/analysis/scheduler/SchedulerAlertActionPanel.vue'
import SchedulerHealthPanel from '@/components/analysis/scheduler/SchedulerHealthPanel.vue'
import SchedulerHeroPanel from '@/components/analysis/scheduler/SchedulerHeroPanel.vue'
import SchedulerPolicyPanel from '@/components/analysis/scheduler/SchedulerPolicyPanel.vue'
import SchedulerQueueHealthPanel from '@/components/analysis/scheduler/SchedulerQueueHealthPanel.vue'
import SchedulerSelectedTaskPanel from '@/components/analysis/scheduler/SchedulerSelectedTaskPanel.vue'
import SchedulerTaskDetailDrawer from '@/components/analysis/scheduler/SchedulerTaskDetailDrawer.vue'
import SchedulerTaskWorkbenchPanel from '@/components/analysis/scheduler/SchedulerTaskWorkbenchPanel.vue'
import { useSchedulerCenter } from '@/composables/useSchedulerCenter'
import { GRID_GAP } from '@/constants/design-tokens'
import type { SchedulerScope } from '@/types/analysis-scheduler'

const {
  actionState,
  activityItems,
  clearSelection,
  closePriorityModal,
  currentFocusCards,
  detailLoading,
  detailStageWarning,
  detailStages,
  detailView,
  detailVisible,
  executionModeOptions,
  filters,
  focusFailedTasks,
  focusStaleTasks,
  handleCancel,
  handlePageChange,
  handleRerun,
  handleRetry,
  healthItems,
  healthMetaItems,
  healthSummary,
  heroView,
  limit,
  loading,
  openDetail,
  openPriorityModal,
  overviewSummaryCards,
  page,
  pageCount,
  policyItems,
  priorityAlerts,
  priorityDraft,
  prioritySaving,
  priorityVisible,
  queueHealthCards,
  queuePreviewItems,
  queueSummary,
  refreshAll,
  resetFilters,
  searchTasks,
  selectedTask,
  selectedTaskView,
  selectTask,
  setScope,
  showPriorityAction,
  statusOptions,
  submitPriority,
  taskTableRows,
  total,
} = useSchedulerCenter()

function handleScopeUpdate(value: SchedulerScope) {
  setScope(value)
}

const focusedTaskLabel = computed(() => {
  if (!selectedTask.value)
    return null
  return `${selectedTask.value.stockCode} · ${selectedTask.value.taskId}`
})
</script>

<template>
  <n-layout embedded>
    <n-space vertical :size="GRID_GAP.outer">
      <n-card :bordered="false" size="small">
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

            <n-space align="center" :size="8" :wrap="true">
              <n-text strong>
                调度中心
              </n-text>
              <n-tag round size="small" type="info">
                {{ heroView.scopeLabel }}
              </n-tag>
            </n-space>

            <n-space :size="8" :wrap="true">
              <n-tag v-for="item in heroView.highlights" :key="item.key" round size="small">
                {{ item.label }}：{{ item.value }}
              </n-tag>
            </n-space>
          </n-space>

          <n-space vertical :size="10" align="end">
            <n-text depth="3">
              最近刷新：{{ heroView.updatedAt }}
            </n-text>
            <n-button type="primary" :loading="heroView.loading" @click="refreshAll">
              刷新全部
            </n-button>
            <n-radio-group
              v-if="heroView.isAdmin"
              :value="heroView.scope"
              size="small"
              @update:value="handleScopeUpdate"
            >
              <n-radio-button v-for="item in heroView.scopeOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </n-radio-button>
            </n-radio-group>
          </n-space>
        </n-flex>
      </n-card>

      <n-grid :cols="24" responsive="screen" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer">
        <n-grid-item :span="24" :l-span="16">
          <SchedulerHeroPanel :view="heroView" :metrics="overviewSummaryCards" />
        </n-grid-item>

        <n-grid-item :span="24" :l-span="8">
          <SchedulerAlertActionPanel
            :alerts="priorityAlerts"
            :loading="heroView.loading"
            @refresh="refreshAll"
            @focus-stale="focusStaleTasks"
            @focus-failed="focusFailedTasks"
            @reset-filters="resetFilters"
          />
        </n-grid-item>

        <n-grid-item :span="24" :m-span="12" :l-span="8">
          <SchedulerSelectedTaskPanel
            :has-task="Boolean(selectedTask)"
            :metrics="currentFocusCards"
            :summary="selectedTaskView.summary"
            :header-tag="selectedTaskView.headerTag"
            :tags="selectedTaskView.tags"
            :fields="selectedTaskView.fields"
            :progress="selectedTaskView.progress"
            :action-state="actionState"
            :show-priority-action="showPriorityAction"
            @view-detail="openDetail()"
            @retry="handleRetry"
            @rerun="handleRerun"
            @cancel="handleCancel"
            @adjust-priority="openPriorityModal"
            @clear-selection="clearSelection"
          />
        </n-grid-item>

        <n-grid-item :span="24" :m-span="12" :l-span="8">
          <SchedulerQueueHealthPanel
            :summary="queueSummary"
            :metrics="queueHealthCards"
            :items="queuePreviewItems"
          />
        </n-grid-item>

        <n-grid-item :span="24" :m-span="12" :l-span="8">
          <SchedulerHealthPanel
            :worker-healthy="healthItems.some(item => item.key === 'worker' && item.ok)"
            :summary="healthSummary"
            :items="healthItems"
            :meta-items="healthMetaItems"
          />
        </n-grid-item>

        <n-grid-item :span="24" :l-span="16">
          <SchedulerActivityPanel :items="activityItems" :focused-task-label="focusedTaskLabel" />
        </n-grid-item>

        <n-grid-item :span="24" :l-span="8">
          <SchedulerPolicyPanel :items="policyItems" />
        </n-grid-item>

        <n-grid-item :span="24">
          <SchedulerTaskWorkbenchPanel
            v-model:filters="filters"
            :is-admin="heroView.isAdmin"
            :status-options="statusOptions"
            :execution-mode-options="executionModeOptions"
            :loading="loading"
            :summary="queueSummary"
            :rows="taskTableRows"
            :page="page"
            :page-count="pageCount"
            :limit="limit"
            :total="total"
            @search="searchTasks"
            @reset="resetFilters"
            @page-change="handlePageChange"
            @select-task="selectTask"
            @open-detail="openDetail"
          />
        </n-grid-item>
      </n-grid>
    </n-space>

    <SchedulerTaskDetailDrawer
      v-model:show="detailVisible"
      :loading="detailLoading"
      :detail="detailView"
      :stages="detailStages"
      :stage-warning="detailStageWarning"
    />

    <n-modal v-model:show="priorityVisible" preset="card" title="调整任务优先级">
      <n-space vertical :size="12">
        <n-alert type="info" :show-icon="false">
          仅管理员可调整排队中任务的优先级，数值越小越先出队。
        </n-alert>
        <n-form size="small">
          <n-form-item label="优先级">
            <n-input-number v-model:value="priorityDraft" :min="1" :max="9999" />
          </n-form-item>
        </n-form>
        <n-flex justify="end" :size="8">
          <n-button @click="closePriorityModal">
            取消
          </n-button>
          <n-button type="primary" :loading="prioritySaving" @click="submitPriority">
            保存
          </n-button>
        </n-flex>
      </n-space>
    </n-modal>
  </n-layout>
</template>
