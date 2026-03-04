<script setup lang="ts">
import { useAppStore } from '@/store'

const appStore = useAppStore()

const loading = ref(false)

function handleReload() {
  loading.value = true
  appStore.reloadPage()
  setTimeout(() => {
    loading.value = false
  }, 800)
}
</script>

<template>
  <n-tooltip placement="bottom" trigger="hover">
    <template #trigger>
      <n-button text :aria-label="$t('common.reload')" @click="handleReload">
        <template #icon>
          <n-icon>
            <icon-park-outline-refresh :class="{ 'animate-spin': loading }" />
          </n-icon>
        </template>
      </n-button>
    </template>
    <span>{{ $t('common.reload') }}</span>
  </n-tooltip>
</template>
