<script setup lang="ts">
import { useAppStore } from '@/store'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()

const routes = computed(() => {
  return route.matched.filter(item => Boolean(item.meta?.title))
})

function navigate(path: string) {
  if (route.path !== path)
    router.push(path)
}
</script>

<template>
  <n-breadcrumb v-if="appStore.showBreadcrumb">
    <n-breadcrumb-item v-for="item in routes" :key="item.path">
      <n-button text size="small" @click="navigate(item.path)">
        <template #icon>
          <nova-icon v-if="appStore.showBreadcrumbIcon" :icon="item.meta.icon" />
        </template>
        {{ $t(`route.${String(item.name)}`, item.meta.title as string) }}
      </n-button>
    </n-breadcrumb-item>
  </n-breadcrumb>
</template>
