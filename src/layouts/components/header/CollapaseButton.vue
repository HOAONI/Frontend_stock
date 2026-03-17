<script setup lang="ts">
// 侧栏折叠按钮负责切换主布局的菜单展开状态。
import { useAppStore } from '@/store'

const appStore = useAppStore()
</script>

<template>
  <n-tooltip placement="bottom" trigger="hover">
    <template #trigger>
      <n-button text aria-label="切换侧边栏" @click="appStore.toggleCollapse()">
        <template #icon>
          <n-icon>
            <icon-park-outline-menu-unfold v-if="appStore.collapsed" />
            <icon-park-outline-menu-fold v-else />
          </n-icon>
        </template>
      </n-button>
    </template>
    <span>切换侧边栏</span>
  </n-tooltip>
</template>
