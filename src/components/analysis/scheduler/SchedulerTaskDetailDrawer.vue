<script setup lang="ts">
import type { AnalysisScheduleDetail, AnalysisScheduleLastTaskStatus, AnalysisScheduleRunItem } from '@/types/analysis-scheduler'
import { formatDateTime } from '@/utils/stock'

const props = defineProps<{
  loading: boolean
  detail: AnalysisScheduleDetail | null
}>()

const show = defineModel<boolean>('show', { required: true })

function statusLabel(status: AnalysisScheduleLastTaskStatus | AnalysisScheduleRunItem['status']): string {
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

function statusType(status: AnalysisScheduleLastTaskStatus | AnalysisScheduleRunItem['status']): 'default' | 'info' | 'success' | 'warning' | 'error' {
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
</script>

<template>
  <n-drawer v-model:show="show" width="540" placement="right">
    <n-drawer-content title="定时任务详情" closable>
      <n-spin :show="loading">
        <n-space v-if="detail" vertical :size="20">
          <n-card size="small" :bordered="false">
            <n-space vertical :size="14">
              <n-flex justify="space-between" align="center">
                <n-space align="center" :size="8">
                  <n-text strong style="font-size: 18px;">
                    {{ detail.schedule.stockCode }}
                  </n-text>
                  <n-tag round :type="detail.schedule.enabled ? 'success' : 'default'" size="small">
                    {{ detail.schedule.enabled ? '启用中' : '已暂停' }}
                  </n-tag>
                </n-space>

                <n-tag round :type="statusType(detail.schedule.lastTaskStatus)" size="small">
                  {{ statusLabel(detail.schedule.lastTaskStatus) }}
                </n-tag>
              </n-flex>

              <n-descriptions label-placement="left" bordered :column="1" size="small">
                <n-descriptions-item label="执行周期">
                  {{ detail.schedule.intervalMinutes }} 分钟
                </n-descriptions-item>
                <n-descriptions-item label="分析模式">
                  {{ detail.schedule.executionMode === 'auto' ? 'Auto' : 'Paper' }}
                </n-descriptions-item>
                <n-descriptions-item label="下次执行">
                  {{ formatDateTime(detail.schedule.nextRunAt) }}
                </n-descriptions-item>
                <n-descriptions-item label="最近触发">
                  {{ formatDateTime(detail.schedule.lastTriggeredAt) }}
                </n-descriptions-item>
                <n-descriptions-item label="最近完成">
                  {{ formatDateTime(detail.schedule.lastCompletedAt) }}
                </n-descriptions-item>
                <n-descriptions-item label="最近消息">
                  {{ detail.schedule.lastTaskMessage || '--' }}
                </n-descriptions-item>
              </n-descriptions>
            </n-space>
          </n-card>

          <n-card size="small" :bordered="false" title="最近 10 次执行记录">
            <n-empty v-if="detail.recentRuns.length === 0" description="暂无执行记录" />

            <n-space v-else vertical :size="12">
              <div v-for="item in detail.recentRuns" :key="item.taskId" class="schedule-run-card">
                <n-flex justify="space-between" align="center" :wrap="true">
                  <n-space align="center" :size="8">
                    <n-text strong>
                      {{ item.taskId }}
                    </n-text>
                    <n-tag size="small" round :type="statusType(item.status)">
                      {{ statusLabel(item.status) }}
                    </n-tag>
                  </n-space>

                  <n-text depth="3">
                    {{ formatDateTime(item.createdAt) }}
                  </n-text>
                </n-flex>

                <n-space class="schedule-run-card__meta" :size="10" :wrap="true">
                  <n-tag size="small" round>
                    第 {{ item.attemptNo }} 次
                  </n-tag>
                  <n-tag size="small" round>
                    {{ item.executionMode === 'broker' ? 'Broker' : 'Paper' }}
                  </n-tag>
                  <n-tag size="small" round>
                    进度 {{ item.progress }}%
                  </n-tag>
                </n-space>

                <div class="schedule-run-card__message">
                  {{ item.message || item.error || '--' }}
                </div>
              </div>
            </n-space>
          </n-card>
        </n-space>

        <n-empty v-else description="请选择一条定时任务查看详情" />
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.schedule-run-card {
  padding: 14px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.03);
}

.schedule-run-card__meta {
  margin-top: 10px;
}

.schedule-run-card__message {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--n-text-color-2);
}
</style>
