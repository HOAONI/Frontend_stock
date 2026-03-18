<script setup lang="ts">
import { NAlert, NCard, NEmpty, NSpace, NTag, NText } from 'naive-ui'
import { computed } from 'vue'

import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { BacktestAiInterpretation } from '@/types/backtest-ai'

interface BacktestAiInterpretationPanelItem {
  key: string
  title: string
  interpretation: BacktestAiInterpretation | null
}

const props = defineProps<{
  mode: 'strategy' | 'agent'
  items: BacktestAiInterpretationPanelItem[]
  pending?: boolean
  jobStatus?: string | null
  errorMessage?: string | null
}>()

const isEmpty = computed(() => props.items.length === 0)
const normalizedJobStatus = computed(() => String(props.jobStatus || '').trim().toLowerCase())

function interpretationTagType(status: string | undefined): NaiveUI.ThemeColor {
  if (status === 'ready')
    return 'success'
  if (status === 'pending' || status === 'processing')
    return 'warning'
  if (status === 'unavailable')
    return 'warning'
  if (status === 'failed')
    return 'error'
  return 'default'
}

function interpretationStatusText(status: string | undefined): string {
  if (status === 'ready')
    return '已生成'
  if (status === 'pending' || status === 'processing')
    return '生成中'
  if (status === 'unavailable')
    return '暂不可用'
  if (status === 'failed')
    return '生成失败'
  return '未生成'
}

function interpretationSourceText(interpretation: BacktestAiInterpretation | null): string {
  if (!interpretation)
    return '--'
  const sourceText = interpretation.source === 'personal' ? '个人 AI' : interpretation.source === 'system' ? '系统 AI' : interpretation.source || 'AI'
  const providerText = interpretation.provider || '--'
  const modelText = interpretation.model || '--'
  return `${sourceText} · ${providerText} · ${modelText}`
}

function resolvedItemStatus(item: BacktestAiInterpretationPanelItem): string | undefined {
  if (item.interpretation?.status)
    return item.interpretation.status
  if (props.pending)
    return 'pending'
  if (normalizedJobStatus.value === 'failed')
    return 'failed'
  return undefined
}

function resolvedItemSummary(item: BacktestAiInterpretationPanelItem): string {
  if (item.interpretation?.summary)
    return item.interpretation.summary
  if (props.pending)
    return 'AI 解读生成中，系统会自动刷新当前结果。'
  if (normalizedJobStatus.value === 'failed')
    return props.errorMessage || 'AI 解读任务失败，请稍后重试。'
  return '暂无 AI 解读'
}
</script>

<template>
  <n-card title="AI 回测解读" :size="CARD_DENSITY.default">
    <n-space vertical :size="SPACING.sm">
      <n-alert
        v-if="pending"
        type="warning"
        :show-icon="false"
      >
        {{ mode === 'strategy' ? '策略回测已完成，AI 解读生成中，系统会自动刷新。' : 'Agent 回放仍在精修中，精修完成后会自动生成最终 AI 解读。' }}
      </n-alert>

      <n-alert
        v-else-if="normalizedJobStatus === 'failed'"
        type="error"
        :show-icon="false"
      >
        {{ errorMessage || 'AI 解读任务失败，请稍后重试。' }}
      </n-alert>

      <n-empty
        v-if="isEmpty && !pending && normalizedJobStatus !== 'failed'"
        :description="mode === 'strategy' ? '当前回测暂无 AI 解读' : '当前回放暂无 AI 解读'"
      />

      <n-card
        v-for="item in items"
        :key="item.key"
        size="small"
        embedded
      >
        <n-space vertical :size="SPACING.xs">
          <n-space justify="space-between" align="center" class="w-full">
            <n-space align="center">
              <strong>{{ item.title }}</strong>
              <n-tag
                v-if="item.interpretation?.verdict"
                size="small"
                :type="interpretationTagType(item.interpretation?.status)"
              >
                {{ item.interpretation?.verdict }}
              </n-tag>
            </n-space>
            <n-tag
              size="small"
              :type="interpretationTagType(resolvedItemStatus(item))"
            >
              {{ interpretationStatusText(resolvedItemStatus(item)) }}
            </n-tag>
          </n-space>

          <n-alert
            v-if="item.interpretation ? item.interpretation.status !== 'ready' : pending || normalizedJobStatus === 'failed'"
            :type="resolvedItemStatus(item) === 'failed' ? 'error' : 'warning'"
            :show-icon="false"
          >
            {{ resolvedItemSummary(item) }}
          </n-alert>
          <n-text v-else-if="item.interpretation" class="leading-6">
            {{ item.interpretation.summary }}
          </n-text>
          <n-text v-else depth="3">
            {{ resolvedItemSummary(item) }}
          </n-text>

          <n-text depth="3" class="text-12px">
            模型来源: {{ interpretationSourceText(item.interpretation) }}
          </n-text>
        </n-space>
      </n-card>
    </n-space>
  </n-card>
</template>
