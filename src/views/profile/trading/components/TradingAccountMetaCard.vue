<script setup lang="ts">
// 交易账户元信息卡片负责展示账户环境、币种和同步时间等信息。
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountMetaItem } from '../types'

defineProps<{
  items: TradingAccountMetaItem[]
}>()
</script>

<template>
  <n-card title="状态元信息" :size="CARD_DENSITY.default">
    <n-space vertical :size="SPACING.md">
      <n-descriptions :column="1" bordered size="small" label-placement="left">
        <n-descriptions-item
          v-for="item in items"
          :key="item.key"
          :label="item.label"
        >
          <n-tag v-if="item.type && item.type !== 'default'" size="small" :type="item.type">
            {{ item.value }}
          </n-tag>
          <n-text v-else>
            {{ item.value }}
          </n-text>
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>
