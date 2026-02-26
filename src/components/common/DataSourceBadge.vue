<script setup lang="ts">
import { shouldEnableBadge } from '@/services/data-source'

const props = withDefaults(defineProps<{
  source: 'api' | 'mock' | 'derived'
  missingApis?: string[]
}>(), {
  missingApis: () => [],
})

const visible = computed(() => shouldEnableBadge())

const type = computed(() => {
  if (props.source === 'api')
    return 'success'
  if (props.source === 'derived')
    return 'warning'
  return 'error'
})

const text = computed(() => {
  if (props.source === 'api')
    return '真实接口数据'
  if (props.source === 'derived')
    return '派生数据'
  return '模拟数据'
})
</script>

<template>
  <n-popover v-if="visible" trigger="hover">
    <template #trigger>
      <n-tag size="small" :type="type">
        {{ text }}
      </n-tag>
    </template>
    <n-space vertical :size="6" style="max-width: 360px;">
      <n-text>
        当前数据来源：{{ text }}
      </n-text>
      <n-text v-if="missingApis.length > 0" depth="3">
        缺失接口：{{ missingApis.join(', ') }}
      </n-text>
    </n-space>
  </n-popover>
</template>
