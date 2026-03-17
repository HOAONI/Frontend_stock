<script setup lang="ts">
// 交易账户摘要卡片负责展示资产、收益和仓位等聚合结果。
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountCountItem, TradingAccountRatioItem } from '../types'

defineProps<{
  ready: boolean
  loading: boolean
  countItems: TradingAccountCountItem[]
  ratioItems: TradingAccountRatioItem[]
}>()
</script>

<template>
  <n-card title="持仓摘要" :size="CARD_DENSITY.default">
    <n-spin :show="loading">
      <n-empty
        v-if="!ready"
        description="模拟盘校验完成后可查看持仓摘要"
      />
      <n-space v-else vertical :size="SPACING.md">
        <n-grid :cols="24" :x-gap="SPACING.md" :y-gap="SPACING.md" responsive="screen">
          <n-grid-item
            v-for="item in countItems"
            :key="item.key"
            :span="24"
            :s-span="8"
          >
            <n-card embedded :size="CARD_DENSITY.embedded">
              <n-statistic :label="item.label" :value="item.value" />
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-grid :cols="24" :x-gap="SPACING.md" :y-gap="SPACING.md" responsive="screen">
          <n-grid-item
            v-for="item in ratioItems"
            :key="item.key"
            :span="24"
            :m-span="12"
          >
            <n-card embedded :size="CARD_DENSITY.embedded">
              <n-space vertical :size="SPACING.sm">
                <n-space justify="space-between" align="center">
                  <n-text depth="3">
                    {{ item.label }}
                  </n-text>
                  <n-text>
                    {{ item.percentage }}%
                  </n-text>
                </n-space>
                <n-progress type="dashboard" :percentage="item.percentage" :status="item.status" :gap-degree="120" />
                <n-text depth="3">
                  {{ item.valueLabel }}
                </n-text>
              </n-space>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-space>
    </n-spin>
  </n-card>
</template>
