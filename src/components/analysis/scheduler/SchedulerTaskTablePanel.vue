<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import {
  NButton as TableButton,
  NEllipsis as TableEllipsis,
  NProgress as TableProgress,
  NSpace as TableSpace,
  NTag as TableTag,
  NText as TableText,
} from 'naive-ui'
import { h } from 'vue'
import type { SchedulerTaskTableRow } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  loading: boolean
  summary: string
  rows: SchedulerTaskTableRow[]
  page: number
  pageCount: number
  limit: number
  total: number
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  selectTask: [taskId: string]
  openDetail: [taskId: string]
}>()

const columns = computed<DataTableColumns<SchedulerTaskTableRow>>(() => [
  {
    title: '股票代码',
    key: 'stockCode',
    width: 170,
    fixed: 'left',
    render(row) {
      return h(TableSpace, { align: 'center', size: 6 }, {
        default: () => [
          h(TableText, { strong: true }, { default: () => row.stockCode }),
          row.selected
            ? h(TableTag, { round: true, size: 'small', type: 'primary' }, { default: () => '已选中' })
            : null,
        ],
      })
    },
  },
  {
    title: '报告类型',
    key: 'reportType',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render(row) {
      return h(TableTag, { round: true, size: 'small', type: row.statusTag.type }, { default: () => row.statusTag.label })
    },
  },
  {
    title: '执行模式',
    key: 'executionModeLabel',
    width: 130,
  },
  {
    title: '提交人',
    key: 'ownerLabel',
    width: 160,
    ellipsis: { tooltip: true },
  },
  {
    title: '优先级',
    key: 'priority',
    width: 90,
  },
  {
    title: '进度',
    key: 'progress',
    width: 180,
    render(row) {
      if (row.progress == null) {
        return h(TableText, { depth: 3 }, { default: () => row.progressLabel })
      }

      return h(TableProgress, {
        type: 'line',
        percentage: row.progress,
        indicatorPlacement: 'inside',
        processing: row.progress < 100,
      })
    },
  },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '最近消息',
    key: 'message',
    minWidth: 260,
    render(row) {
      return h(TableSpace, { vertical: true, size: 6 }, {
        default: () => [
          h(TableTag, { round: true, size: 'small', type: row.messageType }, { default: () => '消息' }),
          h(TableEllipsis, { tooltip: true, lineClamp: 2 }, { default: () => row.message }),
        ],
      })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    fixed: 'right',
    render(row) {
      return h(TableSpace, { size: 8 }, {
        default: () => [
          h(TableButton, {
            size: 'small',
            secondary: true,
            type: row.selected ? 'primary' : 'default',
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              emit('selectTask', row.taskId)
            },
          }, {
            default: () => row.selected ? '已选中' : '选中',
          }),
          h(TableButton, {
            size: 'small',
            tertiary: true,
            type: 'primary',
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              emit('openDetail', row.taskId)
            },
          }, {
            default: () => '详情',
          }),
        ],
      })
    },
  },
])

function rowProps(row: SchedulerTaskTableRow) {
  return {
    onClick: () => emit('selectTask', row.taskId),
  }
}
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            任务总表
          </n-text>
          <n-text strong>
            DataTable 全量扫描
          </n-text>
        </n-space>
        <n-text depth="3">
          {{ props.summary }}
        </n-text>
      </n-flex>

      <n-data-table
        :bordered="false"
        :columns="columns"
        :data="props.rows"
        :loading="props.loading"
        :pagination="false"
        :row-key="row => row.key"
        :row-props="rowProps"
        :scroll-x="1600"
        size="small"
        striped
      />

      <n-flex justify="end">
        <n-pagination
          :page="props.page"
          :page-count="props.pageCount"
          :page-size="props.limit"
          :item-count="props.total"
          @update:page="emit('pageChange', $event)"
        />
      </n-flex>
    </n-space>
  </n-card>
</template>
