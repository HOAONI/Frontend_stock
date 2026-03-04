<script setup lang="ts">
import type { RouteLocationNormalized } from 'vue-router'
import { useTabStore } from '@/store'
import Reload from './Reload.vue'
import DropTabs from './DropTabs.vue'
import ContentFullScreen from './ContentFullScreen.vue'

const tabStore = useTabStore()
const { t } = useI18n()

const router = useRouter()

function resolveLabel(route: RouteLocationNormalized) {
  return t(`route.${String(route.name)}`, route.meta.title as string)
}

function handleTabChange(value: string | number) {
  router.push(String(value))
}

function handleTabClose(value: string | number) {
  tabStore.closeTab(String(value))
}
</script>

<template>
  <n-space justify="space-between" align="center" :wrap="false" style="width: 100%;">
    <n-tabs
      :value="tabStore.currentTabPath"
      type="card"
      size="small"
      closable
      animated
      style="flex: 1; min-width: 0;"
      @update:value="handleTabChange"
      @close="handleTabClose"
    >
      <n-tab-pane
        v-for="item in tabStore.pinTabs"
        :key="item.fullPath"
        :name="item.fullPath"
        :tab="resolveLabel(item)"
      />
      <n-tab-pane
        v-for="item in tabStore.tabs"
        :key="item.fullPath"
        :name="item.fullPath"
        :tab="resolveLabel(item)"
        closable
      />
    </n-tabs>

    <n-space align="center" :wrap="false">
      <Reload />
      <ContentFullScreen />
      <DropTabs />
    </n-space>
  </n-space>
</template>
