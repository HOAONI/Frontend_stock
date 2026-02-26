<script setup lang="ts">
import type { CurvePoint } from '@/types/backtest-analytics'
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'

const props = defineProps<{
  curves: CurvePoint[]
}>()

const options = ref<ECOption>({})

function rebuild() {
  options.value = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: props.curves.map(item => item.label),
      boundaryGap: false,
    },
    yAxis: { type: 'value', name: '回撤(%)' },
    series: [
      {
        name: '回撤',
        type: 'line',
        showSymbol: false,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        data: props.curves.map(item => item.drawdownPct),
      },
    ],
    grid: { left: 48, right: 20, top: 24, bottom: 28 },
  }
}

useEcharts('drawdownRef', options)
watch(() => props.curves, rebuild, { deep: true, immediate: true })
</script>

<template>
  <div ref="drawdownRef" class="h-220px w-full" />
</template>
