<script setup lang="ts">
import { useAppStore } from '@/store'

const appStore = useAppStore()
</script>

<template>
  <n-tooltip placement="bottom" trigger="hover">
    <template #trigger>
      <n-button text :aria-label="$t('app.toggleSider')" @click="appStore.toggleCollapse()">
        <template #icon>
          <n-icon>
            <icon-park-outline-menu-unfold v-if="appStore.collapsed" />
            <icon-park-outline-menu-fold v-else />
          </n-icon>
        </template>
      </n-button>
    </template>
    <span>{{ $t('app.toggleSider') }}</span>
  </n-tooltip>
</template>
