<script setup lang="ts">
import type { AnalysisScheduleFormModel, AnalysisScheduleItem } from '@/types/analysis-scheduler'

const props = defineProps<{
  editingSchedule: AnalysisScheduleItem | null
  saving: boolean
  modeOptions: ReadonlyArray<{ label: string, value: 'auto' | 'paper' }>
}>()

const emit = defineEmits<{
  submit: []
  cancelEdit: []
}>()

const form = defineModel<AnalysisScheduleFormModel>('form', { required: true })

const cardTitle = computed(() => props.editingSchedule ? '编辑定时任务' : '新增定时任务')
const actionText = computed(() => props.editingSchedule ? '保存变更' : '创建任务')
const selectOptions = computed(() => props.modeOptions.map(item => ({ ...item })))
</script>

<template>
  <n-card :bordered="false" size="small" class="schedule-form-card">
    <n-space vertical :size="16">
      <div class="schedule-form-card__header">
        <div>
          <div class="schedule-form-card__title">
            {{ cardTitle }}
          </div>
          <div class="schedule-form-card__desc">
            创建后会立即触发一次分析，之后按所选分钟周期持续执行。
          </div>
        </div>
        <n-tag v-if="editingSchedule" size="small" type="warning" round>
          正在编辑
        </n-tag>
      </div>

      <n-form label-placement="top">
        <n-grid :cols="24" :x-gap="16" :y-gap="8">
          <n-form-item-gi label="股票代码" :span="24" :m-span="8">
            <n-input
              v-model:value="form.stockCode"
              placeholder="例如 600519 / 00700 / AAPL"
              clearable
            />
          </n-form-item-gi>

          <n-form-item-gi label="周期（分钟）" :span="24" :m-span="8">
            <n-input-number
              v-model:value="form.intervalMinutes"
              :min="1"
              :max="10080"
              clearable
              style="width: 100%;"
            />
          </n-form-item-gi>

          <n-form-item-gi label="分析模式" :span="24" :m-span="8">
            <n-select
              v-model:value="form.executionMode"
              :options="selectOptions"
            />
          </n-form-item-gi>
        </n-grid>
      </n-form>

      <n-alert type="info" :show-icon="false">
        `Auto` 会按当前用户的交易与权限配置决定是否进入自动执行链路；`Paper` 仅生成分析结果。
      </n-alert>

      <n-flex justify="end" :size="8">
        <n-button v-if="editingSchedule" @click="emit('cancelEdit')">
          取消编辑
        </n-button>
        <n-button type="primary" :loading="saving" @click="emit('submit')">
          {{ actionText }}
        </n-button>
      </n-flex>
    </n-space>
  </n-card>
</template>

<style scoped>
.schedule-form-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.schedule-form-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--n-text-color);
}

.schedule-form-card__desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--n-text-color-3);
}
</style>
