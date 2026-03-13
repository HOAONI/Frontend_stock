<script setup lang="ts">
import type { SchedulerMetricItem } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  items: SchedulerMetricItem[]
  loading: boolean
}>()

const itemOrder = ['stale', 'pending', 'processing', 'failed', 'rate', 'wait']

const orderedItems = computed(() => {
  const itemMap = new Map(props.items.map(item => [item.key, item]))
  return itemOrder
    .map(key => itemMap.get(key))
    .filter((item): item is SchedulerMetricItem => Boolean(item))
})

function gridSpan(key: string) {
  if (key === 'stale' || key === 'wait')
    return { span: 1, sSpan: 2, lSpan: 6 }
  return { span: 1, sSpan: 1, lSpan: 3 }
}
</script>

<template>
  <n-card :bordered="false" :segmented="{ content: true }" size="small">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="start" :wrap="true" :size="12">
        <n-space vertical :size="6">
          <n-text depth="3">
            关键指标
          </n-text>
          <n-text strong>
            队列压力与结果概览
          </n-text>
        </n-space>
        <n-tag round size="small" type="info">
          metrics
        </n-tag>
      </n-flex>

      <n-spin :show="props.loading">
        <n-grid v-if="orderedItems.length" cols="1 s:2 l:6" responsive="screen" :x-gap="12" :y-gap="12">
          <n-grid-item
            v-for="item in orderedItems"
            :key="item.key"
            :span="gridSpan(item.key).span"
            :s-span="gridSpan(item.key).sSpan"
            :l-span="gridSpan(item.key).lSpan"
          >
            <n-card embedded size="small" :bordered="false">
              <n-space vertical :size="10">
                <n-flex justify="space-between" align="center" :wrap="true" :size="8">
                  <n-text strong>
                    {{ item.label }}
                  </n-text>
                  <n-tag round size="small" :type="item.type">
                    指标
                  </n-tag>
                </n-flex>
                <n-statistic :value="item.value" />
                <n-text depth="3">
                  {{ item.hint }}
                </n-text>
              </n-space>
            </n-card>
          </n-grid-item>
        </n-grid>

        <n-empty v-else description="暂无指标数据" />
      </n-spin>
    </n-space>
  </n-card>
</template>
