<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import type {
  SchedulerFilterForm,
} from '@/types/analysis-scheduler-view'

const props = defineProps<{
  isAdmin: boolean
  statusOptions: SelectOption[]
  executionModeOptions: SelectOption[]
}>()

const emit = defineEmits<{
  search: []
  reset: []
}>()

const filters = defineModel<SchedulerFilterForm>('filters', { required: true })

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
</script>

<template>
  <n-card :bordered="false" size="small" class="scheduler-panel-card">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            筛选工作台
          </n-text>
          <n-text strong>
            快速定位调度任务
          </n-text>
        </n-space>
        <n-tag round size="small" type="warning">
          filters
        </n-tag>
      </n-flex>

      <n-text depth="3">
        按状态、执行模式、股票代码、提交用户与时间窗口组合筛选，支持快速切换到异常任务视图。
      </n-text>

      <n-form :model="filters" label-placement="top" size="small">
        <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
          <n-form-item-gi label="状态" :span="24" :m-span="12" :l-span="8">
            <n-select
              :value="filters.status"
              clearable
              :options="props.statusOptions"
              placeholder="状态筛选"
              @update:value="patchFilters({ status: $event || null })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="执行模式" :span="24" :m-span="12" :l-span="8">
            <n-select
              :value="filters.executionMode"
              clearable
              :options="props.executionModeOptions"
              placeholder="执行模式"
              @update:value="patchFilters({ executionMode: $event || null })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="股票代码" :span="24" :m-span="12" :l-span="8">
            <n-input
              :value="filters.stockCode"
              clearable
              placeholder="如 AAPL / 600519"
              @update:value="patchFilters({ stockCode: $event })"
            />
          </n-form-item-gi>

          <n-form-item-gi v-if="props.isAdmin" label="提交用户" :span="24" :m-span="12" :l-span="8">
            <n-input
              :value="filters.username"
              clearable
              placeholder="用户名"
              @update:value="patchFilters({ username: $event })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="时间范围" :span="24" :m-span="12" :l-span="16">
            <n-date-picker
              type="daterange"
              clearable
              :value="filters.dateRange"
              class="w-full"
              @update:value="patchFilters({ dateRange: normalizeDateRange($event) })"
            />
          </n-form-item-gi>

          <n-form-item-gi label="异常筛选" :span="24">
            <n-checkbox
              :checked="filters.staleOnly"
              @update:checked="patchFilters({ staleOnly: $event })"
            >
              仅看异常任务
            </n-checkbox>
          </n-form-item-gi>
        </n-grid>
      </n-form>

      <n-space :size="8" :wrap="true">
        <n-button type="primary" @click="emit('search')">
          查询
        </n-button>
        <n-button @click="emit('reset')">
          重置
        </n-button>
      </n-space>
    </n-space>
  </n-card>
</template>

<style scoped>
.scheduler-panel-card {
  height: 100%;
}
</style>
