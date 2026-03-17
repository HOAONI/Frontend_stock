<script setup lang="ts">
// 根组件负责用 Suspense 承接异步初始化后的应用壳层。
import AppMain from './AppMain.vue'
import AppLoading from './components/common/AppLoading.vue'

// 使用 Suspense 处理异步组件加载
</script>

<template>
  <Suspense>
    <!-- 异步组件 -->
    <AppMain />

    <!-- 加载状态 -->
    <template #fallback>
      <AppLoading />
    </template>
  </Suspense>
</template>
