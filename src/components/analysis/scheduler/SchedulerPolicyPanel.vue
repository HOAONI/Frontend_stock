<script setup lang="ts">
// 调度中心策略面板负责解释当前调度规则、优先级和运行模式。
import type { SchedulerPolicyItem } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  items: SchedulerPolicyItem[]
}>()
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
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
        健康检查同步刷新当前生效策略，便于快速确认调度阈值和轮询参数。
      </n-text>

      <n-grid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
        <n-grid-item v-for="item in props.items" :key="item.key">
          <n-card embedded size="small" :bordered="false">
            <n-space vertical :size="10">
              <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                <n-text strong>
                  {{ item.title }}
                </n-text>
                <n-tag round size="small">
                  {{ item.value }}
                </n-tag>
              </n-flex>

              <n-text depth="3">
                {{ item.description }}
              </n-text>

              <n-text depth="3">
                {{ item.envKey }}
              </n-text>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </n-space>
  </n-card>
</template>
