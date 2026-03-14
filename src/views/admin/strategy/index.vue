<script setup lang="ts">
import { NTag } from 'naive-ui'
import { h } from 'vue'
import type { SystemConfigItem } from '@/types/system-config'
import {
  getSystemConfig,
  SystemConfigConflictError,
  SystemConfigValidationError,
  updateSystemConfig,
  validateSystemConfig,
} from '@/api/system-config'
import { getSystemConfigFieldDisplay } from '@/utils/system-config-display'

const loading = ref(false)
const saving = ref(false)
const filter = ref('')
const errorText = ref('')

const configVersion = ref('')
const maskToken = ref('******')
const items = ref<SystemConfigItem[]>([])

const drawerVisible = ref(false)
const currentItem = ref<SystemConfigItem | null>(null)
const editValue = ref('')
const editIssues = ref<string[]>([])

const filteredItems = computed(() => {
  return items.value
    .filter(item => ['base', 'backtest'].includes(item.schema?.category || ''))
    .filter((item) => {
      const keyword = filter.value.trim().toLowerCase()
      const display = getSystemConfigFieldDisplay(item)
      if (!keyword)
        return true
      return [
        item.key,
        display.title,
        display.description,
        display.categoryTitle,
      ].some(text => String(text || '').toLowerCase().includes(keyword))
    })
})

function getCategoryTagType(category?: string | null): 'info' | 'warning' | 'default' {
  if (category === 'backtest')
    return 'warning'
  if (category === 'base')
    return 'info'
  return 'default'
}

function renderConfigName(row: SystemConfigItem) {
  const display = getSystemConfigFieldDisplay(row)
  return h('div', { class: 'config-name-cell' }, [
    h('div', { class: 'config-primary-text' }, display.title),
    h('div', { class: 'config-secondary-text' }, row.key),
  ])
}

function renderConfigDescription(row: SystemConfigItem) {
  const display = getSystemConfigFieldDisplay(row)
  return h(
    'div',
    {
      class: 'config-description-cell',
      title: display.description || '暂未提供用途说明',
    },
    display.description || '暂未提供用途说明',
  )
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const config = await getSystemConfig(true)
    configVersion.value = config.configVersion
    maskToken.value = config.maskToken
    items.value = config.items
  }
  catch (error: unknown) {
    errorText.value = (error as { message?: string }).message || '加载策略参数失败'
  }
  finally {
    loading.value = false
  }
}

function openEditor(item: SystemConfigItem) {
  currentItem.value = item
  editValue.value = item.value
  editIssues.value = []
  drawerVisible.value = true
}

async function saveCurrent() {
  if (!currentItem.value)
    return

  saving.value = true
  errorText.value = ''
  editIssues.value = []

  try {
    const changed = [{
      key: currentItem.value.key,
      value: editValue.value,
    }]

    const validation = await validateSystemConfig({ items: changed })
    if (!validation.valid) {
      editIssues.value = validation.issues.map(issue => issue.message)
      return
    }

    await updateSystemConfig({
      configVersion: configVersion.value,
      maskToken: maskToken.value,
      reloadNow: true,
      items: changed,
    })

    drawerVisible.value = false
    window.$message.success('策略参数已更新')
    await load()
  }
  catch (error: unknown) {
    if (error instanceof SystemConfigValidationError) {
      editIssues.value = error.issues.map(issue => issue.message)
      return
    }
    if (error instanceof SystemConfigConflictError) {
      errorText.value = '配置版本冲突，请重新加载后再试'
      return
    }
    errorText.value = (error as { message?: string }).message || '保存失败'
  }
  finally {
    saving.value = false
  }
}

const columns = [
  {
    title: '参数名称',
    key: 'key',
    render: (row: SystemConfigItem) => renderConfigName(row),
  },
  {
    title: '用途说明',
    key: 'description',
    render: (row: SystemConfigItem) => renderConfigDescription(row),
  },
  {
    title: '分类',
    key: 'category',
    render: (row: SystemConfigItem) => {
      const display = getSystemConfigFieldDisplay(row)
      return h(
        NTag,
        {
          size: 'small',
          type: getCategoryTagType(row.schema?.category),
          round: true,
        },
        {
          default: () => display.categoryTitle,
        },
      )
    },
  },
  {
    title: '当前值',
    key: 'value',
    ellipsis: {
      tooltip: true,
    },
  },
]

onMounted(load)
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="策略参数管理" size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="filter" clearable placeholder="按参数名、用途说明或键名过滤" style="width: 360px" />
        <n-button :loading="loading" @click="load">
          刷新
        </n-button>
      </n-space>
      <n-text depth="3" class="mt-3 block text-12px">
        当前页面仅展示“基础配置”和“回测参数”两类与策略执行直接相关的配置项。
      </n-text>
      <n-alert v-if="errorText" type="error" class="mt-3">
        {{ errorText }}
      </n-alert>
    </n-card>

    <n-card size="small" title="参数列表">
      <n-data-table
        :loading="loading"
        :columns="columns"
        :data="filteredItems"
        :row-key="(row: SystemConfigItem) => row.key"
        :row-props="(row: SystemConfigItem) => ({ style: 'cursor:pointer', onClick: () => openEditor(row) })"
      />
    </n-card>

    <n-drawer v-model:show="drawerVisible" :width="520">
      <n-drawer-content title="编辑策略参数" closable>
        <template v-if="currentItem">
          <n-space vertical :size="12">
            <n-descriptions :column="1" bordered size="small">
              <n-descriptions-item label="参数名称">
                {{ getSystemConfigFieldDisplay(currentItem).title }}
              </n-descriptions-item>
              <n-descriptions-item label="原始键名">
                {{ currentItem.key }}
              </n-descriptions-item>
              <n-descriptions-item label="分类">
                {{ getSystemConfigFieldDisplay(currentItem).categoryTitle }}
              </n-descriptions-item>
              <n-descriptions-item label="数据类型">
                {{ getSystemConfigFieldDisplay(currentItem).dataTypeLabel }}
              </n-descriptions-item>
              <n-descriptions-item label="用途说明">
                {{ getSystemConfigFieldDisplay(currentItem).description || '暂未提供用途说明' }}
              </n-descriptions-item>
            </n-descriptions>

            <n-form-item label="参数值">
              <n-input
                v-if="currentItem.schema?.uiControl !== 'textarea'"
                v-model:value="editValue"
                :type="currentItem.schema?.isSensitive ? 'password' : 'text'"
                show-password-on="click"
              />
              <n-input
                v-else
                v-model:value="editValue"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 8 }"
              />
            </n-form-item>

            <n-alert v-for="message in editIssues" :key="message" type="error">
              {{ message }}
            </n-alert>

            <n-space justify="end">
              <n-button @click="drawerVisible = false">
                取消
              </n-button>
              <n-button type="primary" :loading="saving" @click="saveCurrent">
                保存
              </n-button>
            </n-space>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </n-space>
</template>

<style scoped>
.config-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-primary-text {
  font-weight: 600;
  line-height: 1.4;
}

.config-secondary-text {
  color: var(--n-text-color-3);
  font-size: 12px;
  line-height: 1.4;
}

.config-description-cell {
  color: var(--n-text-color-2);
  font-size: 13px;
  line-height: 1.5;
  white-space: normal;
}
</style>
