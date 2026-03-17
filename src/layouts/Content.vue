<script setup lang="ts">
// 主内容区容器负责承接路由页面，并统一内容滚动区域。
import { SPACING } from '@/constants/design-tokens'
import { useAppStore } from '@/store'

const appStore = useAppStore()

const contentStyle = computed(() => {
  const padding = appStore.isMobile ? SPACING.md : SPACING.lg
  return { padding: `${padding}px` }
})
</script>

<template>
  <n-el :style="contentStyle">
    <router-view v-slot="{ Component, route }">
      <component :is="Component" v-if="appStore.loadFlag" :key="route.fullPath" />
    </router-view>
  </n-el>
</template>
