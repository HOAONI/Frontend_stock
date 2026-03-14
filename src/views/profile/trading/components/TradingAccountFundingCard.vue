<script setup lang="ts">
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingAddFundsFormModel } from '../types'

defineProps<{
  enabled: boolean
  cashText: string
  totalAssetText: string
  loading: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

const form = defineModel<TradingAddFundsFormModel>('form', {
  required: true,
})
</script>

<template>
  <n-card title="增加资金" :size="CARD_DENSITY.default">
    <n-space vertical :size="SPACING.md">
      <n-text depth="3">
        仅支持正向入金。入金成功后，账户快照、Agent 上下文与分析约束会同步更新。
      </n-text>

      <n-empty
        v-if="!enabled"
        description="初始化并校验模拟账户后可增加资金"
      />
      <template v-else>
        <n-descriptions :column="2" bordered size="small" label-placement="left">
          <n-descriptions-item label="当前可用现金">
            {{ cashText }}
          </n-descriptions-item>
          <n-descriptions-item label="当前总资产">
            {{ totalAssetText }}
          </n-descriptions-item>
        </n-descriptions>

        <n-form label-placement="top">
          <n-grid :cols="24" :x-gap="SPACING.md" :y-gap="SPACING.xs" responsive="screen">
            <n-grid-item :span="24" :m-span="10">
              <n-form-item label="增加金额">
                <n-input-number
                  v-model:value="form.amount"
                  :min="0.01"
                  :step="1000"
                  :precision="2"
                  placeholder="例如：10000"
                />
              </n-form-item>
            </n-grid-item>

            <n-grid-item :span="24" :m-span="14">
              <n-form-item label="备注（可选）">
                <n-input
                  v-model:value="form.note"
                  maxlength="200"
                  show-count
                  placeholder="例如：策略追加资金"
                />
              </n-form-item>
            </n-grid-item>
          </n-grid>

          <n-space justify="end">
            <n-button type="primary" :loading="loading" @click="emit('submit')">
              确认增加资金
            </n-button>
          </n-space>
        </n-form>
      </template>
    </n-space>
  </n-card>
</template>
