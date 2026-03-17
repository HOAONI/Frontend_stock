<script setup lang="ts">
// 面包屑组件负责根据当前路由展示导航层级。
const router = useRouter()
const route = useRoute()

const routes = computed(() => {
  return route.matched.filter(item => Boolean(item.meta?.title))
})

function navigate(path: string) {
  if (route.path !== path)
    router.push(path)
}
</script>

<template>
  <n-breadcrumb>
    <n-breadcrumb-item v-for="item in routes" :key="item.path">
      <n-button text size="small" @click="navigate(item.path)">
        <template #icon>
          <NovaIcon v-if="item.meta.icon" :icon="item.meta.icon" />
        </template>
        {{ item.meta.title }}
      </n-button>
    </n-breadcrumb-item>
  </n-breadcrumb>
</template>
