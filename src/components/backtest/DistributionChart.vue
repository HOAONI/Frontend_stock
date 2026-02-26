<script setup lang="ts">
import type { TradeDistribution } from '@/types/backtest-analytics'
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'

const props = defineProps<{
  distribution: TradeDistribution
}>()

const options = ref<ECOption>({})

function rebuild() {
  const dist = props.distribution
  options.value = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '交易分布',
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { name: 'Long', value: dist.longCount },
          { name: 'Cash', value: dist.cashCount },
          { name: 'Win', value: dist.winCount },
          { name: 'Loss', value: dist.lossCount },
          { name: 'Neutral', value: dist.neutralCount },
        ],
      },
    ],
  }
}

useEcharts('distributionRef', options)
watch(() => props.distribution, rebuild, { deep: true, immediate: true })
</script>

<template>
  <div ref="distributionRef" class="h-260px w-full" />
</template>
