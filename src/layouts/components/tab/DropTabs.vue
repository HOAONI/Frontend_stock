<script setup lang="ts">
import type { DropdownOption } from 'naive-ui'
import { useTabStore } from '@/store'

const tabStore = useTabStore()
const router = useRouter()
const { t } = useI18n()

const options = computed<DropdownOption[]>(() => {
  return tabStore.allTabs.map((item) => {
    return {
      label: t(`route.${String(item.name)}`, item.meta.title as string),
      key: item.fullPath,
    }
  })
})

function handleDropTabs(key: string | number) {
  router.push(String(key))
}
</script>

<template>
  <n-dropdown
    :options="options"
    trigger="click"
    size="small"
    @select="handleDropTabs"
  >
    <n-button text aria-label="标签页列表">
      <template #icon>
        <n-icon>
          <icon-park-outline-application-menu />
        </n-icon>
      </template>
    </n-button>
  </n-dropdown>
</template>
