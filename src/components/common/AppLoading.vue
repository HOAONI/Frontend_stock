<!-- 全局加载占位组件，用于异步初始化或页面切换时提供统一反馈。 -->
<template>
  <naive-provider>
    <n-flex justify="center" align="center" style="height: 100vh;">
      <n-spin size="large">
        <template #description>
          Loading...
        </template>
      </n-spin>
    </n-flex>
  </naive-provider>
</template>
