<script setup lang="ts">
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAccountHeroModel } from '../types'

defineProps<{
  hero: TradingAccountHeroModel
  error?: string
}>()
</script>

<template>
  <n-card title="账户总览" :size="CARD_DENSITY.default" :segmented="{ content: 'soft' }">
    <template #header-extra>
      <n-tag :type="hero.statusType">
        {{ hero.statusLabel }}
      </n-tag>
    </template>

    <n-space vertical :size="SPACING.md">
      <n-space vertical :size="SPACING.sm">
        <n-text strong>
          {{ hero.title }}
        </n-text>
        <n-text depth="3">
          {{ hero.description }}
        </n-text>
      </n-space>

      <n-space :size="SPACING.sm" wrap>
        <n-tag size="small" type="info">
          提供方：{{ hero.providerLabel }}
        </n-tag>
        <n-tag size="small" type="default">
          环境：{{ hero.environmentLabel }}
        </n-tag>
        <n-tag size="small" type="default">
          来源：{{ hero.dataSourceLabel }}
        </n-tag>
      </n-space>

      <n-descriptions :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item label="账户标识">
          {{ hero.accountUid }}
        </n-descriptions-item>
        <n-descriptions-item label="最近校验">
          {{ hero.lastVerifiedAt }}
        </n-descriptions-item>
        <n-descriptions-item label="最近同步">
          {{ hero.lastSyncedAt }}
        </n-descriptions-item>
        <n-descriptions-item label="当前状态">
          <n-tag size="small" :type="hero.statusType">
            {{ hero.statusLabel }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>

      <n-alert v-if="error" type="error" :show-icon="false">
        {{ error }}
      </n-alert>
    </n-space>
  </n-card>
</template>
