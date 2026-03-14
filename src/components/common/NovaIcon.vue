<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { resolveInlineSvgIcon } from '@/utils/runtime-icon'

interface iconPorps {
  /* 图标名称 */
  icon?: string
  /* 图标颜色 */
  color?: string
  /* 图标大小 */
  size?: number
  /* 图标深度 */
  depth?: 1 | 2 | 3 | 4 | 5
}
const { size = 18, icon } = defineProps<iconPorps>()
const inlineSvg = computed(() => resolveInlineSvgIcon(icon))
</script>

<template>
  <n-icon
    v-if="icon"
    :size="size"
    :depth="depth"
    :color="color"
  >
    <template v-if="inlineSvg">
      <i v-html="inlineSvg" />
    </template>
    <template v-else>
      <Icon :icon="icon" />
    </template>
  </n-icon>
</template>
