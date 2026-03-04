<script setup lang="ts">
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'
import { CHART_HEIGHT, GRID_GAP, SPACING } from '@/constants/design-tokens'
import type { FactorSnapshot, IntradayPoint } from '@/types/market-analytics'
import { fetchMarketBundle, fetchQuoteOnly } from '@/services/market-service'
import { formatDateTime, formatPct, validateStockCode } from '@/utils/stock'

const stockCode = ref('600519')
const days = ref(120)
const loading = ref(false)
const autoRefresh = ref(true)
const isMobile = useMediaQuery('(max-width: 1024px)')

const quote = ref<Awaited<ReturnType<typeof fetchQuoteOnly>>['data']['quote']>(null)
const bars = ref<Array<{ date: string, open: number, close: number, low: number, high: number }>>([])
const intraday = ref<IntradayPoint[]>([])

const factors = ref<FactorSnapshot>({
  ma5: null,
  ma10: null,
  ma20: null,
  ma60: null,
  rsi14: null,
  momentum20: null,
  volRatio5: null,
  amplitude: null,
})

const sourceTag = ref<'api' | 'mock' | 'derived'>('api')
const missingApis = ref<string[]>([])
const warnings = ref<string[]>([])

const klineOptions = ref<ECOption>({})
const intradayOptions = ref<ECOption>({})

let refreshTimer: number | null = null

function stopPolling() {
  if (refreshTimer != null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startPolling() {
  stopPolling()
  if (!autoRefresh.value)
    return

  refreshTimer = window.setInterval(async () => {
    await refreshQuoteOnly()
  }, 5000)
}

function pushIntradayPoint(point: IntradayPoint) {
  intraday.value = [...intraday.value.slice(-239), point]
}

function clearIntraday() {
  intraday.value = []
  rebuildIntraday()
}

function toFactorText(value: number | null, suffix = '', digits = 2): string {
  if (value == null || Number.isNaN(value))
    return '--'
  return `${value.toFixed(digits)}${suffix}`
}

const factorCards = computed(() => {
  return [
    { label: 'MA5', value: toFactorText(factors.value.ma5, '', 2) },
    { label: 'MA10', value: toFactorText(factors.value.ma10, '', 2) },
    { label: 'MA20', value: toFactorText(factors.value.ma20, '', 2) },
    { label: 'MA60', value: toFactorText(factors.value.ma60, '', 2) },
    { label: 'RSI14', value: toFactorText(factors.value.rsi14, '', 2) },
    { label: 'Momentum20', value: toFactorText(factors.value.momentum20, '%', 2) },
    { label: 'VolRatio5', value: toFactorText(factors.value.volRatio5, '', 2) },
    { label: 'Amplitude', value: toFactorText(factors.value.amplitude, '%', 2) },
  ]
})

const sourceType = computed<'success' | 'warning' | 'error'>(() => {
  if (sourceTag.value === 'api')
    return 'success'
  if (sourceTag.value === 'derived')
    return 'warning'
  return 'error'
})

const sourceText = computed(() => {
  if (sourceTag.value === 'api')
    return '真实接口数据'
  if (sourceTag.value === 'derived')
    return '派生数据'
  return '模拟数据'
})

const primaryChartStyle = computed(() => {
  return {
    width: '100%',
    height: `${isMobile.value ? CHART_HEIGHT.primaryMobile : CHART_HEIGHT.primaryDesktop}px`,
  }
})

const secondaryChartStyle = computed(() => {
  return {
    width: '100%',
    height: `${isMobile.value ? CHART_HEIGHT.secondaryMobile : CHART_HEIGHT.secondaryDesktop}px`,
  }
})

function buildMaSeries(window: number) {
  const key = `ma${window}` as keyof FactorSnapshot
  return bars.value.map((_item, index) => {
    const start = index + 1 - window
    if (start < 0)
      return null
    const range = bars.value.slice(start, index + 1)
    const avg = range.reduce((sum, row) => sum + row.close, 0) / window
    if (index === bars.value.length - 1)
      factors.value[key] = avg
    return Number(avg.toFixed(4))
  })
}

function rebuildKline() {
  const categoryData = bars.value.map(item => item.date)
  const seriesData = bars.value.map(item => [item.open, item.close, item.low, item.high])

  const ma5 = buildMaSeries(5)
  const ma10 = buildMaSeries(10)
  const ma20 = buildMaSeries(20)
  const ma60 = buildMaSeries(60)

  klineOptions.value = {
    title: {
      text: `${quote.value?.stockName || stockCode.value} 日线K线 + MA`,
      left: 8,
      textStyle: { fontSize: 14 },
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['K线', 'MA5', 'MA10', 'MA20', 'MA60'],
      top: 6,
      right: 12,
    },
    xAxis: {
      type: 'category',
      data: categoryData,
      boundaryGap: true,
    },
    yAxis: {
      scale: true,
      type: 'value',
    },
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: seriesData,
        itemStyle: {
          color: '#ef4444',
          color0: '#16a34a',
          borderColor: '#ef4444',
          borderColor0: '#16a34a',
        },
      },
      { name: 'MA5', type: 'line', showSymbol: false, smooth: true, data: ma5 },
      { name: 'MA10', type: 'line', showSymbol: false, smooth: true, data: ma10 },
      { name: 'MA20', type: 'line', showSymbol: false, smooth: true, data: ma20 },
      { name: 'MA60', type: 'line', showSymbol: false, smooth: true, data: ma60 },
    ],
    grid: {
      left: 48,
      right: 20,
      top: 64,
      bottom: 32,
    },
  }
}

function rebuildIntraday() {
  intradayOptions.value = {
    title: {
      text: '分时轮询（5秒）',
      left: 8,
      textStyle: { fontSize: 14 },
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: intraday.value.map(item => item.time),
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      scale: true,
    },
    series: [
      {
        type: 'line',
        data: intraday.value.map(item => item.price),
        smooth: true,
        showSymbol: false,
        areaStyle: {
          opacity: 0.1,
        },
      },
    ],
    grid: {
      left: 48,
      right: 20,
      top: 48,
      bottom: 24,
    },
  }
}

async function refreshQuoteOnly() {
  const normalized = validateStockCode(stockCode.value)
  if (!normalized.valid)
    return

  try {
    const result = await fetchQuoteOnly(normalized.normalized)
    sourceTag.value = result.dataSource
    if (result.data.quote)
      quote.value = result.data.quote
    if (result.data.point)
      pushIntradayPoint(result.data.point)
    rebuildIntraday()
  }
  catch {
    window.$message.warning('实时行情刷新失败')
  }
}

async function loadMarket() {
  const normalized = validateStockCode(stockCode.value)
  if (!normalized.valid) {
    window.$message.error(normalized.message || '股票代码不合法')
    return
  }

  loading.value = true
  warnings.value = []
  missingApis.value = []
  try {
    const result = await fetchMarketBundle(normalized.normalized, days.value)
    sourceTag.value = result.dataSource
    warnings.value = result.warnings
    missingApis.value = result.missingApis

    quote.value = result.data.quote
    bars.value = result.data.bars
    intraday.value = result.data.intraday
    factors.value = result.data.factors

    rebuildKline()
    rebuildIntraday()

    if (result.warnings.length > 0)
      window.$message.warning(result.warnings[0])
    else
      window.$message.success(`已加载 ${normalized.normalized} 行情数据`)
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '行情加载失败'
    window.$message.error(message)
  }
  finally {
    loading.value = false
  }
}

useEcharts('klineRef', klineOptions)
useEcharts('intradayRef', intradayOptions)

watch(autoRefresh, () => {
  startPolling()
})

onMounted(async () => {
  await loadMarket()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <n-space vertical :size="SPACING.lg">
    <n-card title="行情控制台" size="small">
      <template #header-extra>
        <n-space :size="SPACING.sm" :wrap="true" align="center">
          <n-tag :type="autoRefresh ? 'success' : 'warning'">
            {{ autoRefresh ? '自动刷新中（5s）' : '已暂停自动刷新' }}
          </n-tag>
          <n-popover trigger="hover">
            <template #trigger>
              <n-tag :type="sourceType">
                {{ sourceText }}
              </n-tag>
            </template>
            <n-space vertical :size="SPACING.sm">
              <n-text>当前来源：{{ sourceText }}</n-text>
              <n-text v-if="missingApis.length > 0" depth="3">
                缺失接口：{{ missingApis.join(', ') }}
              </n-text>
            </n-space>
          </n-popover>
        </n-space>
      </template>

      <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
        <n-grid-item :span="24" :m-span="8" :l-span="5">
          <n-input v-model:value="stockCode" clearable placeholder="股票代码" />
        </n-grid-item>
        <n-grid-item :span="24" :m-span="8" :l-span="4">
          <n-input-number v-model:value="days" :min="10" :max="365" :step="10">
            <template #prefix>
              天数
            </template>
          </n-input-number>
        </n-grid-item>
        <n-grid-item :span="24" :m-span="8" :l-span="5">
          <n-switch v-model:value="autoRefresh">
            <template #checked>
              自动刷新
            </template>
            <template #unchecked>
              已暂停
            </template>
          </n-switch>
        </n-grid-item>
        <n-grid-item :span="24" :m-span="12" :l-span="5">
          <n-button type="primary" :loading="loading" @click="loadMarket">
            加载行情
          </n-button>
        </n-grid-item>
        <n-grid-item :span="24" :m-span="12" :l-span="5">
          <n-button tertiary @click="clearIntraday">
            清空分时
          </n-button>
        </n-grid-item>
      </n-grid>
    </n-card>

    <n-card v-if="warnings.length > 0" title="数据提醒" size="small">
      <n-space vertical :size="SPACING.sm">
        <n-alert v-for="item in warnings" :key="item" type="warning" :show-icon="false">
          {{ item }}
        </n-alert>
      </n-space>
    </n-card>

    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="16">
        <n-card title="日线 K 线图" size="small">
          <div ref="klineRef" :style="primaryChartStyle" />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="8">
        <n-card title="实时行情与因子" size="small">
          <n-space vertical :size="SPACING.md">
            <n-empty v-if="!quote" description="暂无数据" />
            <n-descriptions v-else bordered :column="1" size="small" label-placement="left">
              <n-descriptions-item label="股票">
                {{ quote.stockCode }} - {{ quote.stockName }}
              </n-descriptions-item>
              <n-descriptions-item label="最新价">
                {{ quote.currentPrice }}
              </n-descriptions-item>
              <n-descriptions-item label="涨跌幅">
                <n-tag :type="(quote.changePercent || 0) >= 0 ? 'error' : 'success'">
                  {{ formatPct(quote.changePercent) }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="开盘 / 最高 / 最低">
                {{ quote.open ?? '--' }} / {{ quote.high ?? '--' }} / {{ quote.low ?? '--' }}
              </n-descriptions-item>
              <n-descriptions-item label="成交量">
                {{ quote.volume ?? '--' }}
              </n-descriptions-item>
              <n-descriptions-item label="更新时间">
                {{ formatDateTime(quote.updateTime) }}
              </n-descriptions-item>
            </n-descriptions>

            <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
              <n-grid-item v-for="factor in factorCards" :key="factor.label" :span="12">
                <n-card embedded size="small">
                  <n-space vertical :size="SPACING.xs">
                    <n-text depth="3">
                      {{ factor.label }}
                    </n-text>
                    <n-text strong>
                      {{ factor.value }}
                    </n-text>
                  </n-space>
                </n-card>
              </n-grid-item>
            </n-grid>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="分时轮询曲线" size="small">
      <div ref="intradayRef" :style="secondaryChartStyle" />
    </n-card>
  </n-space>
</template>
