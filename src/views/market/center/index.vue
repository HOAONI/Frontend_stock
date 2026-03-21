<script setup lang="ts">
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'
import { BREAKPOINT_SPAN, CARD_DENSITY, CHART_HEIGHT, DASHBOARD_LAYOUT, GRID_GAP, SPACING } from '@/constants/design-tokens'
import { trendValueStyle } from '@/constants/semantic-ui'
import type { FactorSnapshot, IntradayPoint } from '@/types/market-analytics'
import { fetchMarketBundle, fetchQuoteOnly } from '@/services/market-service'
import { formatDateTime, validateAShareMarketCode } from '@/utils/stock'
import type { CSSProperties } from 'vue'

// 行情中心 = 全量行情加载 + 分时轮询刷新，两套数据源最终汇总到同一块看板里。
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

  // 自动刷新只补最新价和分时点，不重复拉取整段历史 K 线。
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

const marketSourceLabelMap: Record<string, string> = {
  tencent: '腾讯行情',
  sina: '新浪行情',
  efinance: 'EFinance',
  eastmoney: '东方财富',
  tushare: 'Tushare',
}

const sourceText = computed(() => {
  if (sourceTag.value === 'api' && quote.value?.source)
    return `${marketSourceLabelMap[quote.value.source] || quote.value.source} / 真实接口数据`
  if (sourceTag.value === 'api')
    return '真实接口数据'
  if (sourceTag.value === 'derived')
    return '派生数据'
  return '模拟数据'
})

interface MarketKpiCard {
  key: string
  label: string
  value: number | null
  suffix?: string
  precision: number
  valueStyle?: CSSProperties
}

const marketKpiCards = computed<MarketKpiCard[]>(() => {
  return [
    {
      key: 'currentPrice',
      label: '最新价',
      value: quote.value?.currentPrice ?? null,
      precision: 2,
    },
    {
      key: 'change',
      label: '涨跌额',
      value: quote.value?.change ?? null,
      precision: 2,
      valueStyle: trendValueStyle(quote.value?.change, { positive: 'error', negative: 'success', neutral: 'info' }),
    },
    {
      key: 'changePercent',
      label: '涨跌幅',
      value: quote.value?.changePercent ?? null,
      suffix: '%',
      precision: 2,
      valueStyle: trendValueStyle(quote.value?.changePercent, { positive: 'error', negative: 'success', neutral: 'info' }),
    },
    {
      key: 'volume',
      label: '成交量',
      value: quote.value?.volume ?? null,
      precision: 0,
    },
  ]
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
  const normalized = validateAShareMarketCode(stockCode.value)
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
  const normalized = validateAShareMarketCode(stockCode.value)
  if (!normalized.valid) {
    window.$message.error(normalized.message || '股票代码不合法')
    return
  }

  loading.value = true
  warnings.value = []
  missingApis.value = []
  try {
    // 全量加载负责同步 quote / bars / factors 三类数据，并重建两张图表。
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
    <n-card title="行情控制台" :size="CARD_DENSITY.default">
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

      <n-space vertical :size="SPACING.md">
        <n-text depth="3">
          参数组
        </n-text>
        <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
          <n-grid-item :span="24" :m-span="8" :l-span="6">
            <n-input v-model:value="stockCode" clearable placeholder="A股代码（如 600519 / SH600519）" />
          </n-grid-item>
          <n-grid-item :span="24" :m-span="8" :l-span="6">
            <n-input-number v-model:value="days" :min="10" :max="365" :step="10">
              <template #prefix>
                天数
              </template>
            </n-input-number>
          </n-grid-item>
          <n-grid-item :span="24" :m-span="8" :l-span="6">
            <n-switch v-model:value="autoRefresh">
              <template #checked>
                自动刷新
              </template>
              <template #unchecked>
                已暂停
              </template>
            </n-switch>
          </n-grid-item>
        </n-grid>
        <n-space justify="space-between" align="center" :wrap="true">
          <n-text depth="3">
            操作组
          </n-text>
          <n-space :size="SPACING.sm" :wrap="true">
            <n-button type="primary" :loading="loading" @click="loadMarket">
              加载行情
            </n-button>
            <n-button tertiary @click="clearIntraday">
              清空分时
            </n-button>
          </n-space>
        </n-space>
      </n-space>
    </n-card>

    <n-card v-if="warnings.length > 0" title="数据提醒" :size="CARD_DENSITY.default">
      <n-space vertical :size="SPACING.sm">
        <n-alert v-for="item in warnings" :key="item" type="warning" :show-icon="false">
          {{ item }}
        </n-alert>
      </n-space>
    </n-card>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <!-- 先给出最常看的四个 KPI，避免用户必须先读表或图。 -->
      <n-grid-item
        v-for="item in marketKpiCards"
        :key="item.key"
        :span="BREAKPOINT_SPAN.mobile"
        :m-span="BREAKPOINT_SPAN.desktop4"
        :l-span="BREAKPOINT_SPAN.desktop4"
      >
        <n-card embedded :size="CARD_DENSITY.embedded">
          <n-space vertical :size="SPACING.xs">
            <n-text depth="3">
              {{ item.label }}
            </n-text>
            <n-statistic :value="item.value ?? 0" :precision="item.precision" :value-style="item.valueStyle">
              <template v-if="item.suffix" #suffix>
                {{ item.suffix }}
              </template>
            </n-statistic>
            <n-text v-if="item.value == null" depth="3">
              --
            </n-text>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="16">
        <n-card title="日线 K 线图" size="small">
          <div ref="klineRef" :style="primaryChartStyle" />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="8">
        <!-- 右侧把实时 quote 和派生因子放在一起，方便对照图表快速判断。 -->
        <n-card title="实时行情与因子" size="small">
          <n-space vertical :size="SPACING.md">
            <n-empty v-if="!quote" description="暂无数据" />
            <template v-else>
              <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
                <n-grid-item :span="12" :m-span="6" :l-span="6">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.xs">
                      <n-text depth="3">
                        最新价
                      </n-text>
                      <n-statistic v-if="quote.currentPrice != null" :value="quote.currentPrice" :precision="2" />
                      <n-text v-else strong>
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="12" :m-span="6" :l-span="6">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.xs">
                      <n-text depth="3">
                        涨跌幅
                      </n-text>
                      <n-statistic
                        v-if="quote.changePercent != null"
                        :value="quote.changePercent"
                        :precision="2"
                        :value-style="trendValueStyle(quote.changePercent, { positive: 'error', negative: 'success', neutral: 'info' })"
                      >
                        <template #suffix>
                          %
                        </template>
                      </n-statistic>
                      <n-text v-else strong>
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="12" :m-span="6" :l-span="6">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.xs">
                      <n-text depth="3">
                        涨跌额
                      </n-text>
                      <n-statistic
                        v-if="quote.change != null"
                        :value="quote.change"
                        :precision="2"
                        :value-style="trendValueStyle(quote.change, { positive: 'error', negative: 'success', neutral: 'info' })"
                      />
                      <n-text v-else strong>
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="12" :m-span="6" :l-span="6">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.xs">
                      <n-text depth="3">
                        成交量
                      </n-text>
                      <n-statistic v-if="quote.volume != null" :value="quote.volume" :precision="0" />
                      <n-text v-else strong>
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>
              </n-grid>

              <n-descriptions bordered :column="1" size="small" label-placement="left">
                <n-descriptions-item label="股票">
                  {{ quote.stockCode }} - {{ quote.stockName }}
                </n-descriptions-item>
                <n-descriptions-item label="开盘 / 最高 / 最低">
                  {{ quote.open ?? '--' }} / {{ quote.high ?? '--' }} / {{ quote.low ?? '--' }}
                </n-descriptions-item>
                <n-descriptions-item label="更新时间">
                  {{ formatDateTime(quote.updateTime) }}
                </n-descriptions-item>
              </n-descriptions>
            </template>

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

    <n-card title="分时轮询曲线" :size="CARD_DENSITY.default">
      <div ref="intradayRef" :style="secondaryChartStyle" />
    </n-card>
  </n-space>
</template>
