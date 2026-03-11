<script setup lang="ts">
import SchedulerFiltersPanel from '@/components/analysis/scheduler/SchedulerFiltersPanel.vue'
import SchedulerHealthPanel from '@/components/analysis/scheduler/SchedulerHealthPanel.vue'
import SchedulerHeroPanel from '@/components/analysis/scheduler/SchedulerHeroPanel.vue'
import SchedulerPolicyPanel from '@/components/analysis/scheduler/SchedulerPolicyPanel.vue'
import SchedulerSelectedTaskPanel from '@/components/analysis/scheduler/SchedulerSelectedTaskPanel.vue'
import SchedulerTaskDetailDrawer from '@/components/analysis/scheduler/SchedulerTaskDetailDrawer.vue'
import SchedulerTaskQueueCard from '@/components/analysis/scheduler/SchedulerTaskQueueCard.vue'
import { useSchedulerCenter } from '@/composables/useSchedulerCenter'
import { CARD_DENSITY, GRID_GAP, SPACING } from '@/constants/design-tokens'
import type { SchedulerScope } from '@/types/analysis-scheduler'

const {
  actionState,
  clearSelection,
  closePriorityModal,
  detailLoading,
  detailStageWarning,
  detailStages,
  detailView,
  detailVisible,
  executionModeOptions,
  filters,
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
  overviewCards,
  page,
  pageCount,
  policyItems,
  priorityDraft,
  prioritySaving,
  priorityVisible,
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
  taskCards,
  total,
} = useSchedulerCenter()

function handleScopeUpdate(value: SchedulerScope) {
  setScope(value)
}
</script>

<template>
  <div class="scheduler-page">
    <n-space vertical :size="SPACING.lg">
      <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
        <n-grid-item :span="24" :l-span="12">
          <SchedulerHeroPanel :view="heroView" @refresh="refreshAll()" @update:scope="handleScopeUpdate" />
        </n-grid-item>

        <n-grid-item :span="24" :m-span="12" :l-span="6">
          <SchedulerHealthPanel
            :worker-healthy="healthItems.some(item => item.key === 'worker' && item.ok)"
            :summary="healthSummary"
            :items="healthItems"
            :meta-items="healthMetaItems"
          />
        </n-grid-item>

        <n-grid-item :span="24" :m-span="12" :l-span="6">
          <SchedulerPolicyPanel :items="policyItems" />
        </n-grid-item>
      </n-grid>

      <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
        <n-grid-item v-for="item in overviewCards" :key="item.key" :span="24" :m-span="12" :l-span="8">
          <n-card :bordered="false" :size="CARD_DENSITY.default" class="scheduler-metric-card">
            <n-space vertical :size="12">
              <n-flex justify="space-between" align="center" :wrap="true">
                <n-text strong>
                  {{ item.label }}
                </n-text>
                <n-tag round size="small" :type="item.type">
                  指标
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

      <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
        <n-grid-item :span="24" :l-span="14">
          <SchedulerFiltersPanel
            v-model:filters="filters"
            :is-admin="heroView.isAdmin"
            :status-options="statusOptions"
            :execution-mode-options="executionModeOptions"
            @search="searchTasks"
            @reset="resetFilters"
          />
        </n-grid-item>

        <n-grid-item :span="24" :l-span="10">
          <SchedulerSelectedTaskPanel
            :has-task="Boolean(selectedTask)"
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
      </n-grid>

      <n-card :bordered="false" :size="CARD_DENSITY.default">
        <n-space vertical :size="SPACING.md">
          <n-flex justify="space-between" align="start" :wrap="true" :size="12">
            <n-space vertical :size="6">
              <n-text depth="3">
                任务队列
              </n-text>
              <n-text strong>
                卡片化任务列表
              </n-text>
            </n-space>
            <n-text depth="3">
              {{ queueSummary }}
            </n-text>
          </n-flex>

          <n-text depth="3">
            每张任务卡保留核心状态、执行模式、提交信息与时间线；点击整卡可选中，深入排查继续走详情抽屉。
          </n-text>

          <n-spin :show="loading">
            <div v-if="taskCards.length > 0" class="scheduler-queue-grid">
              <SchedulerTaskQueueCard
                v-for="item in taskCards"
                :key="item.task.taskId"
                :item="item"
                :selected="selectedTask?.taskId === item.task.taskId"
                @select="selectTask(item.task.taskId)"
                @open-detail="openDetail(item.task.taskId)"
              />
            </div>
            <n-empty v-else description="当前筛选条件下暂无调度任务" />
          </n-spin>

          <n-flex justify="end">
            <n-pagination
              v-model:page="page"
              :page-count="pageCount"
              :page-size="limit"
              :item-count="total"
              @update:page="handlePageChange"
            />
          </n-flex>
        </n-space>
      </n-card>

      <SchedulerTaskDetailDrawer
        v-model:show="detailVisible"
        :loading="detailLoading"
        :detail="detailView"
        :stages="detailStages"
        :stage-warning="detailStageWarning"
      />

      <n-modal v-model:show="priorityVisible" preset="card" title="调整任务优先级" style="width: 420px;">
        <n-space vertical :size="12">
          <n-text depth="3">
            仅管理员可调整排队中任务的优先级，数值越小越先出队。
          </n-text>
          <n-input-number v-model:value="priorityDraft" :min="1" :max="9999" class="w-full" />
          <n-space justify="end">
            <n-button @click="closePriorityModal">
              取消
            </n-button>
            <n-button type="primary" :loading="prioritySaving" @click="submitPriority">
              保存
            </n-button>
          </n-space>
        </n-space>
      </n-modal>
    </n-space>
  </div>
</template>

<style scoped>
.scheduler-metric-card {
  height: 100%;
}

.scheduler-queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

@media (max-width: 767px) {
  .scheduler-queue-grid {
    grid-template-columns: 1fr;
  }
}
</style>
