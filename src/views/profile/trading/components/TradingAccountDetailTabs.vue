<script setup lang="ts">
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountDetailTabModel } from '../types'

defineProps<{
  ready: boolean
  loading: boolean
  error: string
  tabs: TradingAccountDetailTabModel[]
}>()
</script>

<template>
  <n-card title="交易明细" :size="CARD_DENSITY.default">
    <n-spin :show="loading">
      <n-empty
        v-if="!ready"
        description="初始化并校验模拟账户后可查看持仓、委托和成交明细"
      />

      <template v-else>
        <n-tabs type="line" animated>
          <n-tab-pane
            v-for="tab in tabs"
            :key="tab.name"
            :name="tab.name"
          >
            <template #tab>
              <n-space :size="SPACING.xs" align="center">
                <span>{{ tab.label }}</span>
                <n-tag size="small" type="default">
                  {{ tab.count }}
                </n-tag>
              </n-space>
            </template>

            <n-empty v-if="tab.count === 0" :description="tab.emptyDescription" />
            <n-data-table
              v-else
              size="small"
              :columns="tab.columns"
              :data="tab.data"
              :single-line="false"
              :scroll-x="960"
            />
          </n-tab-pane>
        </n-tabs>

        <n-alert v-if="error" type="error">
          {{ error }}
        </n-alert>
      </template>
    </n-spin>
  </n-card>
</template>
