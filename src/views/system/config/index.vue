<script setup lang="ts">
import type { ConfigValidationIssue, SystemConfigCategorySchema, SystemConfigItem } from '@/types/system-config'
import {
  getSystemConfig,
  SystemConfigConflictError,
  SystemConfigValidationError,
  updateSystemConfig,
  validateSystemConfig,
} from '@/api/system-config'
import { extractStockCodesFromImage } from '@/api/stocks'
import {
  getSystemConfigCategoryDisplay,
  getSystemConfigDataTypeLabel,
  getSystemConfigFieldDisplay,
} from '@/utils/system-config-display'

const loading = ref(false)
const saving = ref(false)
const errorText = ref('')
const successText = ref('')

const configVersion = ref('')
const maskToken = ref('******')
const items = ref<SystemConfigItem[]>([])
const draft = ref<Record<string, string>>({})
const activeCategory = ref('base')
const issues = ref<ConfigValidationIssue[]>([])

const categories = computed<SystemConfigCategorySchema[]>(() => {
  const map = new Map<string, SystemConfigCategorySchema>()
  items.value.forEach((item) => {
    const schema = item.schema
    if (!schema)
      return
    const categoryDisplay = getSystemConfigCategoryDisplay(schema.category)
    if (!map.has(schema.category)) {
      map.set(schema.category, {
        category: schema.category,
        title: categoryDisplay.title,
        description: categoryDisplay.description,
        displayOrder: schema.displayOrder,
        fields: [],
      })
    }
    map.get(schema.category)?.fields.push(schema)
  })

  return Array.from(map.values()).sort((a, b) => a.displayOrder - b.displayOrder)
})

const visibleItems = computed(() => {
  return items.value
    .filter(item => (item.schema?.category || 'uncategorized') === activeCategory.value)
    .sort((a, b) => (a.schema?.displayOrder || 9999) - (b.schema?.displayOrder || 9999))
})

const dirtyCount = computed(() => {
  return items.value.filter(item => draft.value[item.key] !== item.value).length
})

const activeCategoryDisplay = computed(() => getSystemConfigCategoryDisplay(activeCategory.value))

function issueMessages(key: string) {
  return issues.value.filter(issue => issue.key === key).map(issue => issue.message)
}

function toDisplayValue(item: SystemConfigItem): string {
  return draft.value[item.key] ?? item.value
}

function getConfigDisplay(item: SystemConfigItem) {
  return getSystemConfigFieldDisplay(item)
}

function getDataTypeTagType(item: SystemConfigItem): 'warning' | 'default' {
  return item.schema?.isSensitive ? 'warning' : 'default'
}

function setValue(key: string, value: string) {
  draft.value = {
    ...draft.value,
    [key]: value,
  }
}

async function loadConfig() {
  loading.value = true
  errorText.value = ''
  successText.value = ''
  try {
    const data = await getSystemConfig(true)
    configVersion.value = data.configVersion
    maskToken.value = data.maskToken
    items.value = data.items

    const nextDraft: Record<string, string> = {}
    data.items.forEach((item) => {
      nextDraft[item.key] = item.value
    })
    draft.value = nextDraft
    issues.value = []

    const firstCategory = data.items.find(item => item.schema?.category)?.schema?.category
    if (firstCategory)
      activeCategory.value = firstCategory
  }
  catch (error: unknown) {
    errorText.value = (error as { message?: string }).message || '加载系统配置失败'
  }
  finally {
    loading.value = false
  }
}

function collectChangedItems() {
  return items.value
    .filter(item => draft.value[item.key] !== item.value)
    .map(item => ({
      key: item.key,
      value: draft.value[item.key],
    }))
}

async function saveConfig() {
  saving.value = true
  errorText.value = ''
  successText.value = ''

  try {
    const changed = collectChangedItems()
    if (changed.length === 0) {
      successText.value = '没有需要保存的更改'
      return
    }

    const validation = await validateSystemConfig({ items: changed })
    issues.value = validation.issues
    if (!validation.valid) {
      errorText.value = '配置校验未通过，请修正后再保存'
      return
    }

    await updateSystemConfig({
      configVersion: configVersion.value,
      maskToken: maskToken.value,
      reloadNow: true,
      items: changed,
    })

    successText.value = '配置保存成功'
    await loadConfig()
  }
  catch (error: unknown) {
    if (error instanceof SystemConfigValidationError) {
      issues.value = error.issues
      errorText.value = error.message
      return
    }

    if (error instanceof SystemConfigConflictError) {
      errorText.value = `${error.message}，请重新加载后再试`
      return
    }

    errorText.value = (error as { message?: string }).message || '配置保存失败'
  }
  finally {
    saving.value = false
  }
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  try {
    const result = await extractStockCodesFromImage(file)
    const unique = [...new Set(result.codes)]
    const merged = unique.join(',')
    if (draft.value.STOCK_LIST != null) {
      setValue('STOCK_LIST', merged)
      successText.value = `图片识别成功，共提取 ${unique.length} 个代码`
    }
    else {
      successText.value = `识别结果：${merged}`
    }
  }
  catch (error: unknown) {
    errorText.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '图片识别失败'
  }
  finally {
    target.value = ''
  }
}

onMounted(loadConfig)
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="系统配置管理" size="small">
      <n-space align="center" :wrap="true">
        <n-button :loading="loading" @click="loadConfig">
          重新加载
        </n-button>
        <n-button type="primary" :loading="saving" @click="saveConfig">
          保存配置（{{ dirtyCount }}）
        </n-button>
        <label class="cursor-pointer">
          <n-button>图片识股（更新 STOCK_LIST）</n-button>
          <input class="hidden" type="file" accept="image/*" @change="handleImageUpload">
        </label>
      </n-space>
      <n-alert v-if="errorText" class="mt-3" type="error">
        {{ errorText }}
      </n-alert>
      <n-alert v-if="successText" class="mt-3" type="success">
        {{ successText }}
      </n-alert>
    </n-card>

    <n-grid :cols="24" :x-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="6">
        <n-card title="配置分类" size="small">
          <n-menu
            :value="activeCategory"
            :options="categories.map((category) => ({
              key: category.category,
              label: `${category.title} (${items.filter(item => item.schema?.category === category.category).length})`,
            }))"
            @update:value="(key) => { activeCategory = String(key); }"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="18">
        <n-card title="配置项" size="small">
          <n-spin :show="loading">
            <n-empty v-if="visibleItems.length === 0" description="当前分类暂无配置项" />
            <n-form v-else label-placement="top">
              <n-alert type="info" class="mb-4">
                <template #header>
                  {{ activeCategoryDisplay.title }}
                </template>
                {{ activeCategoryDisplay.description }}
              </n-alert>
              <n-space vertical :size="14">
                <n-card
                  v-for="item in visibleItems"
                  :key="item.key"
                  embedded
                  size="small"
                >
                  <template #header>
                    <div class="config-card-header">
                      <div class="config-card-title">
                        {{ getConfigDisplay(item).title }}
                      </div>
                      <div class="config-card-subtitle">
                        {{ getConfigDisplay(item).categoryTitle }}
                      </div>
                    </div>
                  </template>
                  <template #header-extra>
                    <n-space size="small" :wrap="true">
                      <n-tag size="small" round>
                        {{ item.key }}
                      </n-tag>
                      <n-tag size="small" round :type="getDataTypeTagType(item)">
                        {{ getSystemConfigDataTypeLabel(item.schema?.dataType) }}
                      </n-tag>
                    </n-space>
                  </template>

                  <n-space vertical :size="10">
                    <n-text depth="3" class="text-12px">
                      {{ getConfigDisplay(item).description || '暂未提供用途说明' }}
                    </n-text>

                    <n-form-item label="配置值">
                      <n-switch
                        v-if="item.schema?.uiControl === 'switch'"
                        :value="toDisplayValue(item) === 'true'"
                        @update:value="(value) => setValue(item.key, value ? 'true' : 'false')"
                      />

                      <n-input-number
                        v-else-if="item.schema?.uiControl === 'number'"
                        :value="Number(toDisplayValue(item))"
                        style="width: 240px"
                        @update:value="(value) => setValue(item.key, String(value ?? ''))"
                      />

                      <n-input
                        v-else-if="item.schema?.uiControl === 'textarea'"
                        type="textarea"
                        :value="toDisplayValue(item)"
                        @update:value="(value) => setValue(item.key, value)"
                      />

                      <n-input
                        v-else
                        :type="item.schema?.isSensitive ? 'password' : 'text'"
                        show-password-on="click"
                        :value="toDisplayValue(item)"
                        @update:value="(value) => setValue(item.key, value)"
                      />
                    </n-form-item>

                    <n-text depth="3" class="text-12px">
                      当前分类：{{ getConfigDisplay(item).categoryTitle }}
                    </n-text>

                    <n-alert
                      v-for="message in issueMessages(item.key)"
                      :key="message"
                      class="mt-2"
                      type="error"
                    >
                      {{ message }}
                    </n-alert>
                  </n-space>
                </n-card>
              </n-space>
            </n-form>
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>
  </n-space>
</template>

<style scoped>
.config-card-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-card-title {
  font-weight: 600;
  line-height: 1.5;
}

.config-card-subtitle {
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.4;
}
</style>
