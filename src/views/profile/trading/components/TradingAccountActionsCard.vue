<script setup lang="ts">
// 交易账户快捷操作卡片负责承接刷新、绑定和导航等高频动作。
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingUiType } from '../types'

const props = defineProps<{
  statusLabel: string
  statusType: TradingUiType
  statusDescription: string
  statusLoading: boolean
  dataLoading: boolean
  canLoadTradingData: boolean
  dataError?: string
}>()

const emit = defineEmits<{
  refreshStatus: []
  refreshData: []
  scrollSetup: []
  scrollFunding: []
}>()

const forcingRefresh = defineModel<boolean>('forcingRefresh', {
  default: false,
})

const actionAlertType = computed<'success' | 'warning'>(() => {
  return props.statusType === 'success' ? 'success' : 'warning'
})
</script>

<template>
  <n-card title="快捷操作" :size="CARD_DENSITY.default">
    <n-space vertical :size="SPACING.md">
      <n-alert :type="actionAlertType" :show-icon="false">
        账户状态：{{ statusLabel }}
      </n-alert>

      <n-text depth="3">
        {{ statusDescription }}
      </n-text>

      <n-switch v-model:value="forcingRefresh">
        <template #checked>
          强制上游刷新
        </template>
        <template #unchecked>
          缓存优先
        </template>
      </n-switch>

      <n-space vertical :size="SPACING.sm">
        <n-button block :loading="statusLoading" @click="emit('refreshStatus')">
          刷新账户状态
        </n-button>
        <n-button
          block
          type="primary"
          :loading="dataLoading"
          :disabled="!canLoadTradingData"
          @click="emit('refreshData')"
        >
          刷新交易快照
        </n-button>
      </n-space>

      <n-space vertical :size="SPACING.sm">
        <n-button secondary block @click="emit('scrollSetup')">
          前往账户初始化
        </n-button>
        <n-button tertiary block :disabled="!canLoadTradingData" @click="emit('scrollFunding')">
          前往增加资金
        </n-button>
      </n-space>

      <n-alert v-if="dataError" type="error" :show-icon="false">
        {{ dataError }}
      </n-alert>
    </n-space>
  </n-card>
</template>
