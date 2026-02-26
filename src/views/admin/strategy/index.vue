<script setup lang="ts">
import type { SystemConfigItem } from '@/types/system-config'
import {
  getSystemConfig,
  SystemConfigConflictError,
  SystemConfigValidationError,
  updateSystemConfig,
  validateSystemConfig,
} from '@/api/system-config'

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
      const keyword = filter.value.trim().toUpperCase()
      if (!keyword)
        return true
      return item.key.includes(keyword)
    })
})

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
  { title: '键名', key: 'key' },
  {
    title: '分类',
    key: 'category',
    render: (row: SystemConfigItem) => row.schema?.category || '--',
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
    <n-card title="策略参数管理（base/backtest）" size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="filter" clearable placeholder="按 key 过滤，例如 BACKTEST" style="width: 320px" />
        <n-button :loading="loading" @click="load">
          刷新
        </n-button>
      </n-space>
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
              <n-descriptions-item label="键名">
                {{ currentItem.key }}
              </n-descriptions-item>
              <n-descriptions-item label="分类">
                {{ currentItem.schema?.category }}
              </n-descriptions-item>
              <n-descriptions-item label="数据类型">
                {{ currentItem.schema?.dataType }}
              </n-descriptions-item>
            </n-descriptions>

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
