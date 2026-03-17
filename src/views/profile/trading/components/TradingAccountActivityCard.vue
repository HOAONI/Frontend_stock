<script setup lang="ts">
// 交易账户近期活动卡片负责展示最近委托、成交和状态摘要。
import type { DataTableColumns } from 'naive-ui'
import { useMediaQuery } from '@vueuse/core'
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountActivityItem, TradingUiType } from '../types'

const props = defineProps<{
  title: string
  countType: TradingUiType
  items: TradingAccountActivityItem[]
  columns: DataTableColumns<TradingAccountActivityItem>
  emptyDescription: string
}>()

const isMobile = useMediaQuery('(max-width: 768px)')

function directionTagType(direction: string): TradingUiType {
  const value = direction.toLowerCase()
  if (value.includes('买') || value.includes('buy'))
    return 'success'
  if (value.includes('卖') || value.includes('sell'))
    return 'warning'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}

function statusTagType(status: string): TradingUiType {
  const value = status.toLowerCase()
  if (value.includes('成') || value.includes('filled') || value.includes('success'))
    return 'success'
  if (value.includes('待') || value.includes('提交') || value.includes('pending'))
    return 'warning'
  if (value.includes('拒') || value.includes('fail') || value.includes('error'))
    return 'error'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}
</script>

<template>
  <n-card :title="title" :size="CARD_DENSITY.default">
    <template #header-extra>
      <n-tag size="small" :type="countType">
        {{ `最近 ${items.length} 条` }}
      </n-tag>
    </template>

    <n-empty v-if="!items.length" :description="emptyDescription" />

    <n-list v-else-if="isMobile" hoverable>
      <n-list-item v-for="item in items" :key="item.id">
        <n-space vertical :size="SPACING.sm">
          <n-space justify="space-between" align="center">
            <n-text strong>
              {{ item.stockCode }}
            </n-text>
            <n-tag size="small" :type="directionTagType(item.direction)">
              {{ item.direction }}
            </n-tag>
          </n-space>
          <n-space :size="SPACING.sm" wrap>
            <n-tag size="small" :type="statusTagType(item.status)">
              {{ item.status }}
            </n-tag>
            <n-text depth="3">
              数量：{{ item.quantity }}
            </n-text>
            <n-text depth="3">
              {{ item.time }}
            </n-text>
          </n-space>
        </n-space>
      </n-list-item>
    </n-list>

    <n-data-table
      v-else
      size="small"
      :columns="props.columns"
      :data="items"
      :bordered="false"
      :pagination="false"
      :row-key="(row: TradingAccountActivityItem) => row.id"
    />
  </n-card>
</template>
