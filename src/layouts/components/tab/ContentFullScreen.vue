<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { useAppStore } from '@/store'

const appStore = useAppStore()

function enterFullContent() {
  appStore.layoutMode = 'full-content'
}

function exitFullContent() {
  if (appStore.layoutMode === 'full-content') {
    appStore.layoutMode = 'vertical'
  }
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && appStore.layoutMode === 'full-content')
    exitFullContent()
})
</script>

<template>
  <n-tooltip v-if="!appStore.isMobile" placement="bottom" trigger="hover">
    <template #trigger>
      <n-button text :aria-label="$t('app.togglContentFullScreen')" @click="enterFullContent">
        <template #icon>
          <n-icon>
            <icon-park-outline-full-screen-one />
          </n-icon>
        </template>
      </n-button>
    </template>
    {{ $t('app.togglContentFullScreen') }}
  </n-tooltip>

  <Teleport to="body">
    <n-button
      v-if="appStore.layoutMode === 'full-content'"
      type="primary"
      circle
      aria-label="退出全内容模式"
      style="position: fixed; right: 16px; top: 16px; z-index: 9999;"
      @click="exitFullContent"
    >
      <template #icon>
        <n-icon>
          <icon-park-outline-off-screen-one />
        </n-icon>
      </template>
    </n-button>
  </Teleport>
</template>
