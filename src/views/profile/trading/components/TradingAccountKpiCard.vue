<script setup lang="ts">
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountKpiModel } from '../types'

defineProps<{
  item: TradingAccountKpiModel
}>()
</script>

<template>
  <n-card embedded :size="CARD_DENSITY.embedded">
    <n-space vertical :size="SPACING.sm">
      <n-text depth="3">
        {{ item.label }}
      </n-text>

      <n-statistic
        v-if="item.value != null"
        :value="item.value"
        :precision="item.precision || 2"
        :value-style="item.valueStyle"
      >
        <template v-if="item.suffix" #suffix>
          {{ item.suffix }}
        </template>
      </n-statistic>
      <n-text v-else strong>
        --
      </n-text>

      <n-text depth="3">
        {{ item.caption }}
      </n-text>
    </n-space>
  </n-card>
</template>
