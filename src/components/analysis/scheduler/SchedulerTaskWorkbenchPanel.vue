<script setup lang="ts">
import type { DataTableColumns, SelectOption } from 'naive-ui'
import {
  NButton as TableButton,
  NEllipsis as TableEllipsis,
  NProgress as TableProgress,
  NSpace as TableSpace,
  NTag as TableTag,
  NText as TableText,
} from 'naive-ui'
import { h } from 'vue'
import type {
  SchedulerFilterForm,
  SchedulerTaskTableRow,
} from '@/types/analysis-scheduler-view'

// 工作台面板负责调度任务的筛选、分页和行级操作入口。
const props = defineProps<{
  isAdmin: boolean
  statusOptions: SelectOption[]
  executionModeOptions: SelectOption[]
  loading: boolean
  summary: string
  rows: SchedulerTaskTableRow[]
  page: number
  pageCount: number
  limit: number
  total: number
}>()

const emit = defineEmits<{
  search: []
  reset: []
  pageChange: [page: number]
  selectTask: [taskId: string]
  openDetail: [taskId: string]
}>()

const filters = defineModel<SchedulerFilterForm>('filters', { required: true })

// 表格列在组件内集中定义，保证筛选区与行内动作始终使用同一份展示规则。
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

function patchFilters(patch: Partial<SchedulerFilterForm>) {
  filters.value = {
    ...filters.value,
    ...patch,
  }
}

function normalizeDateRange(value: number[] | null): [number, number] | null {
  if (!value || value.length !== 2)
    return null
  return [value[0], value[1]]
}

function rowProps(row: SchedulerTaskTableRow) {
  return {
    onClick: () => emit('selectTask', row.taskId),
  }
}
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <!-- 顶部筛选区决定下方列表的 scope、状态和分页结果。 -->
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            任务总表
          </n-text>
          <n-text strong>
            筛选、检索与批量查看入口
          </n-text>
        </n-space>
        <n-text depth="3">
          {{ props.summary }}
        </n-text>
      </n-flex>

      <n-form :model="filters" label-placement="top" size="small">
        <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
          <n-form-item-gi label="状态" :span="24" :m-span="12" :l-span="6">
            <n-select
              :value="filters.status"
              clearable
              :options="props.statusOptions"
              placeholder="状态筛选"
              @update:value="patchFilters({ status: $event || null })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="执行模式" :span="24" :m-span="12" :l-span="6">
            <n-select
              :value="filters.executionMode"
              clearable
              :options="props.executionModeOptions"
              placeholder="执行模式"
              @update:value="patchFilters({ executionMode: $event || null })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="股票代码" :span="24" :m-span="12" :l-span="6">
            <n-input
              :value="filters.stockCode"
              clearable
              placeholder="如 AAPL / 600519"
              @update:value="patchFilters({ stockCode: $event })"
            />
          </n-form-item-gi>

          <n-form-item-gi v-if="props.isAdmin" label="提交用户" :span="24" :m-span="12" :l-span="6">
            <n-input
              :value="filters.username"
              clearable
              placeholder="用户名"
              @update:value="patchFilters({ username: $event })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="时间范围" :span="24" :m-span="12" :l-span="props.isAdmin ? 12 : 10">
            <n-date-picker
              type="daterange"
              clearable
              :value="filters.dateRange"
              @update:value="patchFilters({ dateRange: normalizeDateRange($event) })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="异常筛选" :span="24" :m-span="12" :l-span="props.isAdmin ? 6 : 8">
            <n-checkbox
              :checked="filters.staleOnly"
              @update:checked="patchFilters({ staleOnly: $event })"
            >
              仅看异常任务
            </n-checkbox>
          </n-form-item-gi>

          <n-form-item-gi :span="24">
            <n-flex justify="end" :size="[8, 8]" :wrap="true">
              <n-button type="primary" @click="emit('search')">
                查询
              </n-button>
              <n-button @click="emit('reset')">
                重置
              </n-button>
            </n-flex>
          </n-form-item-gi>
        </n-grid>
      </n-form>

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

      <n-flex justify="space-between" align="center" :wrap="true" :size="12">
        <n-text depth="3">
          共 {{ props.total }} 条任务，当前第 {{ props.page }} / {{ props.pageCount }} 页
        </n-text>
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
