<script setup lang="ts">
import type { TradeDistribution } from '@/types/backtest-analytics'
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'

const props = defineProps<{
  distribution: TradeDistribution
}>()

const positionOptions = ref<ECOption>({})
const outcomeOptions = ref<ECOption>({})

function rebuild() {
  const dist = props.distribution
  positionOptions.value = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '仓位分布',
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { name: 'Long', value: dist.positionDistribution.longCount },
          { name: 'Cash', value: dist.positionDistribution.cashCount },
        ],
      },
    ],
  }

  outcomeOptions.value = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        name: '结果分布',
        type: 'pie',
        radius: ['40%', '70%'],
        data: [
          { name: 'Win', value: dist.outcomeDistribution.winCount },
          { name: 'Loss', value: dist.outcomeDistribution.lossCount },
          { name: 'Neutral', value: dist.outcomeDistribution.neutralCount },
        ],
      },
    ],
  }
}

useEcharts('positionDistributionRef', positionOptions)
useEcharts('outcomeDistributionRef', outcomeOptions)
watch(() => props.distribution, rebuild, { deep: true, immediate: true })
</script>

<template>
  <div class="w-full distribution-grid">
    <div ref="positionDistributionRef" class="h-260px w-full" />
    <div ref="outcomeDistributionRef" class="h-260px w-full" />
  </div>
</template>

<style scoped>
.distribution-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 768px) {
  .distribution-grid {
    grid-template-columns: 1fr;
  }
}
</style>
