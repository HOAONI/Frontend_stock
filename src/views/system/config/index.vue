<script setup lang="ts">
import type { MarketSourceOption } from '@/types/market-source'
import { getMarketSourceConfig, updateMarketSource } from '@/api/market-source'
import { formatDateTime } from '@/utils/stock'

const loading = ref(false)
const saving = ref(false)
const errorText = ref('')
const successText = ref('')
const persistedSource = ref('')
const selectedSource = ref('')
const updatedAt = ref<string | null>(null)
const options = ref<MarketSourceOption[]>([])

const currentOption = computed(() => {
  return options.value.find(option => option.code === persistedSource.value) || null
})

const selectedOption = computed(() => {
  return options.value.find(option => option.code === selectedSource.value) || null
})

const currentSourceText = computed(() => {
  return currentOption.value?.label || persistedSource.value || '--'
})

const currentStatusText = computed(() => {
  return currentOption.value?.available === false ? '不可用' : '可用'
})

const formattedUpdatedAt = computed(() => {
  return formatDateTime(updatedAt.value)
})

const hasChanges = computed(() => {
  return Boolean(selectedSource.value) && selectedSource.value !== persistedSource.value
})

const canSave = computed(() => {
  return hasChanges.value && selectedOption.value?.available
})

const pendingSelectionText = computed(() => {
  return selectedOption.value?.label || selectedSource.value || '--'
})

function resetMessages() {
  errorText.value = ''
  successText.value = ''
}

async function loadMarketSource(loadOptions?: { preserveMessages?: boolean }) {
  loading.value = true
  if (!loadOptions?.preserveMessages)
    resetMessages()

  try {
    const data = await getMarketSourceConfig()
    persistedSource.value = data.currentSource
    selectedSource.value = data.currentSource
    updatedAt.value = data.updatedAt || null
    options.value = data.options
  }
  catch (error: unknown) {
    errorText.value = (error as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message
      || (error as { message?: string }).message
      || '加载全局行情源失败'
  }
  finally {
    loading.value = false
  }
}

async function saveMarketSource() {
  if (!canSave.value)
    return

  saving.value = true
  resetMessages()

  try {
    const result = await updateMarketSource({ source: selectedSource.value })
    persistedSource.value = result.currentSource
    selectedSource.value = result.currentSource
    updatedAt.value = result.updatedAt
    await loadMarketSource({ preserveMessages: true })
    successText.value = `已切换为 ${selectedOption.value?.label || result.currentSource}，新请求将使用该行情源`
  }
  catch (error: unknown) {
    errorText.value = (error as { response?: { data?: { message?: string } }, message?: string })?.response?.data?.message
      || (error as { message?: string }).message
      || '保存全局行情源失败'
  }
  finally {
    saving.value = false
  }
}

function handleReload() {
  void loadMarketSource()
}

function handleSelectOption(option: MarketSourceOption) {
  if (!option.available)
    return

  selectedSource.value = option.code
}

onMounted(() => {
  void loadMarketSource()
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="全局行情源选择" size="small" :segmented="{ content: 'soft' }">
      <template #header-extra>
        <n-tag round type="info" size="small">
          后台管理 / 配置管理
        </n-tag>
      </template>

      <n-space vertical :size="16">
        <n-text depth="3">
          这里的选择会同时影响交易/分析链路，以及行情中心里的实时价、历史 K 线、指标和因子。
          保存后立即对新发起的请求生效，运行中的任务不会被强制切换。
        </n-text>

        <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
          <n-grid-item :span="24" :m-span="8">
            <n-card embedded size="small">
              <n-statistic label="当前全局行情源" :value="currentSourceText" />
            </n-card>
          </n-grid-item>
          <n-grid-item :span="24" :m-span="8">
            <n-card embedded size="small">
              <n-statistic label="当前状态" :value="currentStatusText" />
            </n-card>
          </n-grid-item>
          <n-grid-item :span="24" :m-span="8">
            <n-card embedded size="small">
              <n-statistic label="最近更新时间" :value="formattedUpdatedAt" />
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-space>
    </n-card>

    <n-alert type="info" title="生效范围说明">
      新请求会统一使用当前选中的行情源；这既包括 Agent 在交易/分析链路中的行情请求，也包括后台行情中心展示的 quote / history / indicators / factors。
    </n-alert>

    <n-alert v-if="errorText" type="error">
      {{ errorText }}
    </n-alert>
    <n-alert v-if="successText" type="success">
      {{ successText }}
    </n-alert>

    <n-card title="候选行情源" size="small" :segmented="{ content: 'soft' }">
      <template #header-extra>
        <n-space>
          <n-button :loading="loading" @click="handleReload">
            重新加载
          </n-button>
          <n-button
            type="primary"
            :disabled="!canSave"
            :loading="saving"
            @click="saveMarketSource"
          >
            保存并生效
          </n-button>
        </n-space>
      </template>

      <n-spin :show="loading">
        <n-space vertical :size="12">
          <n-alert v-if="hasChanges" type="warning" title="选择尚未保存">
            已选择 {{ pendingSelectionText }}。点击“保存并生效”后，新请求才会切换到该行情源。
          </n-alert>

          <n-empty v-if="options.length === 0" description="暂无可选行情源" />

          <n-radio-group v-else v-model:value="selectedSource">
            <n-space vertical :size="12">
              <n-card
                v-for="option in options"
                :key="option.code"
                size="small"
                :embedded="selectedSource !== option.code"
                :segmented="{ content: 'soft' }"
                @click="handleSelectOption(option)"
              >
                <template #header>
                  <n-space align="center">
                    <n-radio :value="option.code" :disabled="!option.available" />
                    <n-text strong>
                      {{ option.label }}
                    </n-text>
                  </n-space>
                </template>

                <template #header-extra>
                  <n-space>
                    <n-tag
                      size="small"
                      round
                      :type="option.available ? 'success' : 'warning'"
                    >
                      {{ option.available ? '可用' : '不可用' }}
                    </n-tag>
                    <n-tag
                      v-if="persistedSource === option.code"
                      size="small"
                      round
                      type="info"
                    >
                      当前生效
                    </n-tag>
                    <n-tag
                      v-if="selectedSource === option.code && hasChanges"
                      size="small"
                      round
                      type="warning"
                    >
                      待保存
                    </n-tag>
                  </n-space>
                </template>

                <n-space vertical :size="12">
                  <n-descriptions bordered :column="1" size="small" label-placement="left">
                    <n-descriptions-item label="编码">
                      {{ option.code }}
                    </n-descriptions-item>
                    <n-descriptions-item label="说明">
                      {{ option.description || '--' }}
                    </n-descriptions-item>
                  </n-descriptions>

                  <n-alert v-if="option.reason" type="warning" :show-icon="false">
                    {{ option.reason }}
                  </n-alert>
                </n-space>
              </n-card>
            </n-space>
          </n-radio-group>
        </n-space>
      </n-spin>
    </n-card>
  </n-space>
</template>
