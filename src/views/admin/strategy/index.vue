<script setup lang="ts">
import { NTag } from 'naive-ui'
import { h } from 'vue'
import type { SystemConfigItem } from '@/types/system-config'
import { getSystemConfig } from '@/api/system-config'
import { getSystemConfigFieldDisplay } from '@/utils/system-config-display'

// 管理端策略参数页改为说明页，仅展示后端明确开放的系统级策略项。
const loading = ref(false)
const filter = ref('')
const errorText = ref('')

const items = ref<SystemConfigItem[]>([])

const exposedItems = computed(() => {
  return items.value.filter(item => item.schema?.visibleInStrategyPage)
})

const filteredItems = computed(() => {
  return exposedItems.value
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
    items.value = config.items
  }
  catch (error: unknown) {
    errorText.value = (error as { message?: string }).message || '加载策略参数失败'
  }
  finally {
    loading.value = false
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
    <n-card title="策略参数说明" size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="filter" clearable placeholder="按参数名、用途说明或键名过滤" style="width: 360px" />
        <n-button :loading="loading" @click="load">
          刷新
        </n-button>
      </n-space>
      <n-alert type="info" class="mt-3">
        当前系统级策略参数已收拢为保留项，不再提供后台直接调整。后续若重新开放少量可调项，会由后端 schema 明确下发并展示在此页。
      </n-alert>
      <n-alert v-if="errorText" type="error" class="mt-3">
        {{ errorText }}
      </n-alert>
    </n-card>

    <n-card size="small" title="开放项一览">
      <n-empty
        v-if="exposedItems.length === 0"
        description="当前没有开放可调的系统级策略参数"
      />
      <n-empty
        v-else-if="filteredItems.length === 0"
        description="没有匹配的开放项"
      />
      <n-data-table
        v-else
        :loading="loading"
        :columns="columns"
        :data="filteredItems"
        :row-key="(row: SystemConfigItem) => row.key"
      />
    </n-card>
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
