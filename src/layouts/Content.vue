<script setup lang="ts">
import { SPACING } from '@/constants/design-tokens'
import { useAppStore, useRouteStore } from '@/store'

const appStore = useAppStore()
const routeStore = useRouteStore()
const isMobile = useMediaQuery('(max-width: 1024px)')

const contentStyle = computed(() => {
  if (appStore.layoutMode === 'full-content')
    return {}
  const padding = isMobile.value ? SPACING.md : SPACING.lg
  return { padding: `${padding}px` }
})
</script>

<template>
  <n-el :style="contentStyle">
    <router-view v-slot="{ Component, route }">
      <transition :name="appStore.transitionAnimation" mode="out-in">
        <keep-alive :include="routeStore.cacheRoutes">
          <component :is="Component" v-if="appStore.loadFlag" :key="route.fullPath" />
        </keep-alive>
      </transition>
    </router-view>
  </n-el>
</template>
