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
    legend: { data: ['策略收益', '标的收益'] },
    xAxis: {
      type: 'category',
      data: props.curves.map(item => item.label),
      boundaryGap: false,
    },
    yAxis: { type: 'value', name: '收益(%)' },
    series: [
      {
        name: '策略收益',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: props.curves.map(item => item.strategyReturnPct),
      },
      {
        name: '标的收益',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: props.curves.map(item => item.benchmarkReturnPct),
      },
    ],
    grid: { left: 48, right: 20, top: 40, bottom: 28 },
  }
}

useEcharts('equityRef', options)
watch(() => props.curves, rebuild, { deep: true, immediate: true })
</script>

<template>
  <div ref="equityRef" class="h-260px w-full" />
</template>
