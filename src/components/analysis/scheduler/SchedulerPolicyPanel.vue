<script setup lang="ts">
import type { SchedulerPolicyItem } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  items: SchedulerPolicyItem[]
}>()
</script>

<template>
  <n-card :bordered="false" size="small" class="scheduler-panel-card">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            策略快照
          </n-text>
          <n-text strong>
            调度策略与阈值
          </n-text>
        </n-space>
        <n-tag round size="small">
          policy
        </n-tag>
      </n-flex>

      <n-text depth="3">
        配置快照随健康检查更新，可直接对照 Worker 轮询、超时和心跳参数定位调度异常。
      </n-text>

      <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
        <n-grid-item v-for="item in props.items" :key="item.key" :span="24" :m-span="12">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-descriptions label-placement="top" size="small" :column="1">
                <n-descriptions-item label="配置项">
                  <n-text strong>
                    {{ item.title }}
                  </n-text>
                </n-descriptions-item>
                <n-descriptions-item label="当前值">
                  <span class="scheduler-break-all">{{ item.value }}</span>
                </n-descriptions-item>
              </n-descriptions>
              <n-text depth="3">
                {{ item.description }}
              </n-text>
              <n-code word-wrap>
                {{ item.envKey }}
              </n-code>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-space>
  </n-card>
</template>

<style scoped>
.scheduler-panel-card {
  height: 100%;
}

.scheduler-break-all {
  word-break: break-all;
}
</style>
