<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { NButton, NButtonGroup, NEllipsis, NSwitch, NTag, NText } from 'naive-ui'
import type { AnalysisScheduleItem, AnalysisScheduleLastTaskStatus } from '@/types/analysis-scheduler'
import { formatDateTime } from '@/utils/stock'

const props = defineProps<{
  schedules: AnalysisScheduleItem[]
  loading: boolean
  rowActionId: string | null
}>()

const emit = defineEmits<{
  refresh: []
  edit: [schedule: AnalysisScheduleItem]
  view: [schedule: AnalysisScheduleItem]
  toggle: [payload: { schedule: AnalysisScheduleItem, enabled: boolean }]
  delete: [schedule: AnalysisScheduleItem]
}>()

function statusLabel(status: AnalysisScheduleLastTaskStatus): string {
  if (status === 'pending')
    return '排队中'
  if (status === 'processing')
    return '执行中'
  if (status === 'completed')
    return '已完成'
  if (status === 'failed')
    return '失败'
  if (status === 'cancelled')
    return '已取消'
  if (status === 'skipped')
    return '已跳过'
  return '未触发'
}

function statusType(status: AnalysisScheduleLastTaskStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
  if (status === 'processing')
    return 'info'
  if (status === 'completed')
    return 'success'
  if (status === 'failed')
    return 'error'
  if (status === 'pending' || status === 'skipped')
    return 'warning'
  return 'default'
}

const columns = computed<DataTableColumns<AnalysisScheduleItem>>(() => [
  {
    title: '股票',
    key: 'stockCode',
    width: 130,
    render: row => h(NText, { strong: true }, { default: () => row.stockCode }),
  },
  {
    title: '周期',
    key: 'intervalMinutes',
    width: 120,
    render: row => `${row.intervalMinutes} 分钟`,
  },
  {
    title: '模式',
    key: 'executionMode',
    width: 120,
    render: row => h(
      NTag,
      {
        size: 'small',
        type: row.executionMode === 'auto' ? 'info' : 'default',
        round: true,
      },
      { default: () => row.executionMode === 'auto' ? 'Auto' : 'Paper' },
    ),
  },
  {
    title: '下次执行',
    key: 'nextRunAt',
    minWidth: 160,
    render: row => formatDateTime(row.nextRunAt),
  },
  {
    title: '最近状态',
    key: 'lastTaskStatus',
    width: 120,
    render: row => h(
      NTag,
      {
        size: 'small',
        type: statusType(row.lastTaskStatus),
        round: true,
      },
      { default: () => statusLabel(row.lastTaskStatus) },
    ),
  },
  {
    title: '最近消息',
    key: 'lastTaskMessage',
    minWidth: 220,
    render: row => h(
      NEllipsis,
      { tooltip: true, lineClamp: 2 },
      { default: () => row.lastTaskMessage || '--' },
    ),
  },
  {
    title: '启用',
    key: 'enabled',
    width: 92,
    render: row => h(NSwitch, {
      value: row.enabled,
      loading: props.rowActionId === row.scheduleId,
      'onUpdate:value': (value: boolean) => emit('toggle', { schedule: row, enabled: value }),
    }),
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    render: row => h(
      NButtonGroup,
      { size: 'small' },
      {
        default: () => [
          h(
            NButton,
            { secondary: true, onClick: () => emit('view', row) },
            { default: () => '详情' },
          ),
          h(
            NButton,
            { secondary: true, onClick: () => emit('edit', row) },
            { default: () => '编辑' },
          ),
          h(
            NButton,
            {
              secondary: true,
              type: 'error',
              loading: props.rowActionId === row.scheduleId,
              onClick: () => emit('delete', row),
            },
            { default: () => '删除' },
          ),
        ],
      },
    ),
  },
])
</script>

<template>
  <n-card :bordered="false" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="center" :wrap="true">
        <div>
          <div class="schedule-table-card__title">
            已绑定定时任务
          </div>
          <div class="schedule-table-card__desc">
            支持同一用户绑定多条任务，但会拦截完全相同的股票、周期和模式组合。
          </div>
        </div>

        <n-button tertiary type="primary" :loading="loading" @click="emit('refresh')">
          刷新列表
        </n-button>
      </n-flex>

      <n-data-table
        :columns="columns"
        :data="schedules"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        :scroll-x="1160"
      />
    </n-space>
  </n-card>
</template>

<style scoped>
.schedule-table-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--n-text-color);
}

.schedule-table-card__desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--n-text-color-3);
}
</style>
