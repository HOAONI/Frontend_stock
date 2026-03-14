<script setup lang="ts">
import { CARD_DENSITY, SPACING } from '@/constants/design-tokens'
import type { TradingBindFormModel, TradingUiType } from '../types'

defineProps<{
  statusLabel: string
  statusType: TradingUiType
  inlineError: string
  historicalUidWarning: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  submit: []
  clearAccountUid: []
}>()

const form = defineModel<TradingBindFormModel>('form', {
  required: true,
})

const advancedSections = shallowRef<string[]>([])
</script>

<template>
  <n-card title="初始化 / 更新账户" :size="CARD_DENSITY.default">
    <template #header-extra>
      <n-tag size="small" :type="statusType">
        {{ statusLabel }}
      </n-tag>
    </template>

    <n-space vertical :size="SPACING.md">
      <n-text depth="3">
        默认先维护显示名和初始资金。高级参数按需展开，不再占据首屏注意力。
      </n-text>

      <n-form label-placement="top">
        <n-grid :cols="24" :x-gap="SPACING.md" :y-gap="SPACING.xs" responsive="screen">
          <n-grid-item :span="24" :m-span="12">
            <n-form-item label="显示名">
              <n-input v-model:value="form.accountDisplayName" placeholder="例如：我的本地模拟盘" />
            </n-form-item>
          </n-grid-item>

          <n-grid-item :span="24" :m-span="12">
            <n-form-item label="初始资金">
              <n-input-number
                v-model:value="form.initialCapital"
                :min="1"
                :step="1000"
                placeholder="例如：100000"
              />
            </n-form-item>
          </n-grid-item>
        </n-grid>

        <n-collapse v-model:expanded-names="advancedSections">
          <n-collapse-item title="高级参数" name="advanced">
            <n-grid :cols="24" :x-gap="SPACING.md" :y-gap="SPACING.xs" responsive="screen">
              <n-grid-item :span="24">
                <n-form-item label="账户标识（可选）">
                  <n-input v-model:value="form.accountUid" placeholder="留空则自动生成，例如 bt-user-1" />
                </n-form-item>
                <n-button v-if="form.accountUid" text size="small" @click="emit('clearAccountUid')">
                  清空账户标识
                </n-button>
              </n-grid-item>

              <n-grid-item :span="24" :m-span="12">
                <n-form-item label="手续费率">
                  <n-input-number
                    v-model:value="form.commissionRate"
                    :min="0"
                    :step="0.0001"
                    :precision="6"
                    placeholder="例如：0.0003"
                  />
                </n-form-item>
              </n-grid-item>

              <n-grid-item :span="24" :m-span="12">
                <n-form-item label="滑点（bps）">
                  <n-input-number
                    v-model:value="form.slippageBps"
                    :min="0"
                    :step="0.5"
                    :precision="2"
                    placeholder="例如：2"
                  />
                </n-form-item>
              </n-grid-item>
            </n-grid>
          </n-collapse-item>
        </n-collapse>

        <n-space :size="SPACING.sm" wrap>
          <n-tag type="default">
            提供方：Backtrader Local Sim
          </n-tag>
          <n-tag type="info">
            引擎：Backtrader
          </n-tag>
        </n-space>

        <n-alert v-if="inlineError" type="error">
          {{ inlineError }}
        </n-alert>
        <n-alert v-if="historicalUidWarning" type="warning" :show-icon="false">
          请确认当前填写的账户标识不是旧的历史 ID。
        </n-alert>

        <n-space justify="end">
          <n-button type="primary" :loading="loading" @click="emit('submit')">
            初始化并校验
          </n-button>
        </n-space>
      </n-form>
    </n-space>
  </n-card>
</template>
