<script setup lang="ts">
import { NButton, NTag } from 'naive-ui'
import type { LineSeriesOption } from 'echarts/charts'
import { useEcharts } from '@/hooks/useEcharts'
import type { ECOption } from '@/hooks/useEcharts'
import { CARD_DENSITY, CHART_HEIGHT, DASHBOARD_LAYOUT, GRID_GAP, SPACING } from '@/constants/design-tokens'
import {
  fetchStrategyRunDetail,
  fetchStrategyRunHistory,
  runStrategyRangeBacktest,
} from '@/services/backtest-strategy-service'
import {
  STRATEGY_RANGE_CODES,
  STRATEGY_RANGE_NAME_MAP,
} from '@/types/backtest-strategy'
import type {
  StrategyRangeCode,
  StrategyRangeRunResponse,
  StrategyRunHistoryItem,
  StrategyTradeItem,
} from '@/types/backtest-strategy'
import { h } from 'vue'

const code = ref('')
const dateRange = ref<[number, number] | null>(null)
const strategyCodes = ref<StrategyRangeCode[]>([...STRATEGY_RANGE_CODES])
const initialCapital = ref<number | null>(100000)
const commissionRate = ref<number | null>(0.0003)
const slippageBps = ref<number | null>(2)

const running = ref(false)
const loadingDetail = ref(false)
const loadingHistory = ref(false)
const runError = ref('')

const currentRun = ref<StrategyRangeRunResponse | null>(null)
const historyRows = ref<StrategyRunHistoryItem[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = ref(8)
const selectedRunGroupId = ref<number | null>(null)

const equityOptions = ref<ECOption>({})

const strategyOptions = STRATEGY_RANGE_CODES.map(item => ({
  code: item,
  label: STRATEGY_RANGE_NAME_MAP[item],
}))

function toDayText(value: number): string {
  const day = new Date(value)
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function metric(value: unknown, digits = 2): string {
  const number = Number(value)
  if (!Number.isFinite(number))
    return '--'
  return `${number.toFixed(digits)}%`
}

function money(value: unknown, digits = 2): string {
  const number = Number(value)
  if (!Number.isFinite(number))
    return '--'
  return number.toFixed(digits)
}

function ratioTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  if (number >= 60)
    return 'success'
  if (number >= 40)
    return 'warning'
  return 'error'
}

function returnTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  if (number > 0)
    return 'success'
  if (number < 0)
    return 'error'
  return 'warning'
}

function drawdownTagType(value: unknown): 'success' | 'warning' | 'error' | 'default' {
  const number = Number(value)
  if (!Number.isFinite(number))
    return 'default'
  const absValue = Math.abs(number)
  if (absValue <= 10)
    return 'success'
  if (absValue <= 20)
    return 'warning'
  return 'error'
}

function noTradeReasonText(reason: string): string {
  if (reason === 'no_entry_signal')
    return '无入场信号'
  if (reason === 'entry_rejected_margin')
    return '入场被资金约束拒绝'
  if (reason === 'no_exit_signal')
    return '无离场信号（窗口内）'
  if (reason === 'no_completed_trade')
    return '未形成完整交易'
  return ''
}

function formatNoTradeReason(row: any): string {
  const totalTrades = Number(row.totalTrades)
  if (Number.isFinite(totalTrades) && totalTrades > 0)
    return '--'

  const reason = String(row.noTradeReason || '').trim()
  const detail = String(row.noTradeReasonDetail || '').trim()
  const text = noTradeReasonText(reason) || '--'
  if (text === '--')
    return text
  return detail ? `${text} (${detail})` : text
}

function normalizeStrategySelection(values: StrategyRangeCode[]): StrategyRangeCode[] {
  const selected = Array.from(new Set(values)).filter((item): item is StrategyRangeCode => STRATEGY_RANGE_CODES.includes(item))
  return selected.length > 0 ? selected : [...STRATEGY_RANGE_CODES]
}

function rebuildEquityChart() {
  const run = currentRun.value
  if (!run || run.items.length === 0 || !run.items.some(item => item.equity.length > 0)) {
    equityOptions.value = {}
    return
  }

  const labels = Array.from(new Set(run.items.flatMap(item => item.equity.map(point => point.tradeDate || ''))))
    .filter(item => item.length > 0)
    .sort((a, b) => a.localeCompare(b))
  if (labels.length === 0) {
    equityOptions.value = {}
    return
  }

  const series: LineSeriesOption[] = run.items.map((item) => {
    const map = new Map(item.equity.map(point => [point.tradeDate || '', Number(point.equity)]))
    const data = labels.map((label) => {
      const value = map.get(label)
      return Number.isFinite(value) ? value : null
    })
    return {
      name: item.strategyName,
      type: 'line',
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      data,
    }
  })

  const benchmarkMap = new Map<string, number>()
  run.items.forEach((item) => {
    item.equity.forEach((point) => {
      if (point.tradeDate && Number.isFinite(Number(point.benchmarkEquity)) && !benchmarkMap.has(point.tradeDate))
        benchmarkMap.set(point.tradeDate, Number(point.benchmarkEquity))
    })
  })

  if (benchmarkMap.size > 0) {
    series.push({
      name: 'Benchmark',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { type: 'dashed' },
      connectNulls: true,
      data: labels.map(label => (benchmarkMap.has(label) ? benchmarkMap.get(label) ?? null : null)),
    })
  }

  equityOptions.value = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: 'Equity',
      scale: true,
    },
    grid: { left: 50, right: 20, top: 36, bottom: 28 },
    series,
  }
}

const hasEquityData = computed(() => {
  const run = currentRun.value
  if (!run)
    return false
  return run.items.some(item => item.equity.length > 0)
})

const metricsRows = computed(() => {
  const run = currentRun.value
  if (!run)
    return []
  return run.items.map((item) => {
    const metrics = item.metrics || {}
    return {
      strategyCode: item.strategyCode,
      strategyName: item.strategyName,
      totalReturnPct: Number(metrics.totalReturnPct ?? metrics.total_return_pct),
      benchmarkReturnPct: Number(metrics.benchmarkReturnPct ?? metrics.benchmark_return_pct),
      excessReturnPct: Number(metrics.excessReturnPct ?? metrics.excess_return_pct),
      maxDrawdownPct: Number(metrics.maxDrawdownPct ?? metrics.max_drawdown_pct),
      totalTrades: Number(metrics.totalTrades ?? metrics.total_trades),
      winRatePct: Number(metrics.winRatePct ?? metrics.win_rate_pct),
      sharpeRatio: Number(metrics.sharpeRatio ?? metrics.sharpe_ratio),
      entrySignalCount: Number(metrics.entrySignalCount ?? metrics.entry_signal_count ?? 0),
      exitSignalCount: Number(metrics.exitSignalCount ?? metrics.exit_signal_count ?? 0),
      noTradeReason: String(metrics.noTradeReason ?? metrics.no_trade_reason ?? ''),
      noTradeReasonDetail: String(metrics.noTradeReasonDetail ?? metrics.no_trade_reason_detail ?? ''),
    }
  })
})

const runNoTradeSummary = computed(() => {
  const run = currentRun.value
  if (!run)
    return ''

  const messages = run.items.map((item) => {
    const metrics = item.metrics || {}
    const totalTrades = Number(metrics.totalTrades ?? metrics.total_trades)
    if (Number.isFinite(totalTrades) && totalTrades > 0)
      return ''

    const reason = String(metrics.noTradeReason ?? metrics.no_trade_reason ?? '').trim()
    const detail = String(metrics.noTradeReasonDetail ?? metrics.no_trade_reason_detail ?? '').trim()
    const text = noTradeReasonText(reason)
    if (!text)
      return ''
    return `${item.strategyName}: ${detail ? `${text} (${detail})` : text}`
  }).filter(item => item.length > 0)

  return messages.join('；')
})

const tradeRows = computed(() => {
  const run = currentRun.value
  if (!run)
    return []

  const rows: Array<StrategyTradeItem & { strategyName: string }> = []
  run.items.forEach((item) => {
    item.trades.forEach((trade) => {
      rows.push({
        strategyName: item.strategyName,
        ...trade,
      })
    })
  })

  rows.sort((a, b) => String(a.entryDate || '').localeCompare(String(b.entryDate || '')))
  return rows
})

async function loadHistory(page = historyPage.value) {
  loadingHistory.value = true
  try {
    const data = await fetchStrategyRunHistory({
      page,
      limit: historyPageSize.value,
    })
    historyRows.value = data.items
    historyTotal.value = data.total
    historyPage.value = data.page
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || '加载历史策略回测失败（回测存储未就绪或服务异常）'
    runError.value = message
    historyRows.value = []
    historyTotal.value = 0
    window.$message.error(message)
  }
  finally {
    loadingHistory.value = false
  }
}

async function loadRunDetail(runGroupId: number) {
  loadingDetail.value = true
  runError.value = ''
  try {
    const detail = await fetchStrategyRunDetail(runGroupId)
    currentRun.value = detail
    selectedRunGroupId.value = detail.runGroupId
    rebuildEquityChart()
  }
  catch (error: unknown) {
    runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载回测详情失败'
  }
  finally {
    loadingDetail.value = false
  }
}

async function runBacktest() {
  runError.value = ''
  const normalizedCode = code.value.trim()
  if (!normalizedCode) {
    window.$message.warning('请输入股票代码')
    return
  }
  if (!dateRange.value || dateRange.value.length !== 2) {
    window.$message.warning('请选择日期区间')
    return
  }

  const selectedStrategies = normalizeStrategySelection(strategyCodes.value)
  if (selectedStrategies.length === 0) {
    window.$message.warning('请至少选择一个策略')
    return
  }

  running.value = true
  try {
    const response = await runStrategyRangeBacktest({
      code: normalizedCode,
      startDate: toDayText(dateRange.value[0]),
      endDate: toDayText(dateRange.value[1]),
      strategyCodes: selectedStrategies,
      initialCapital: initialCapital.value ?? undefined,
      commissionRate: commissionRate.value ?? undefined,
      slippageBps: slippageBps.value ?? undefined,
    })

    currentRun.value = response.data
    selectedRunGroupId.value = response.data.runGroupId
    rebuildEquityChart()
    await loadHistory(1)

    const noTradeMessages = response.data.items.map((item) => {
      const metrics = item.metrics || {}
      const totalTrades = Number(metrics.totalTrades ?? metrics.total_trades)
      if (Number.isFinite(totalTrades) && totalTrades > 0)
        return ''

      const reason = String(metrics.noTradeReason ?? metrics.no_trade_reason ?? '').trim()
      const detail = String(metrics.noTradeReasonDetail ?? metrics.no_trade_reason_detail ?? '').trim()
      const text = noTradeReasonText(reason)
      if (!text)
        return ''
      return `${item.strategyName}: ${detail ? `${text} (${detail})` : text}`
    }).filter(item => item.length > 0)

    if (noTradeMessages.length > 0)
      window.$message.warning(`策略回测完成：当前区间无成交信号。${noTradeMessages.join('；')}`)
    else
      window.$message.success('策略回测完成')
  }
  catch (error: unknown) {
    runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '策略回测失败'
  }
  finally {
    running.value = false
  }
}

const metricsColumns = [
  { title: '策略', key: 'strategyName' },
  {
    title: '总收益',
    key: 'totalReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.totalReturnPct) }, { default: () => metric(row.totalReturnPct, 2) }),
  },
  {
    title: '基准收益',
    key: 'benchmarkReturnPct',
    render: (row: any) => metric(row.benchmarkReturnPct, 2),
  },
  {
    title: '超额收益',
    key: 'excessReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.excessReturnPct) }, { default: () => metric(row.excessReturnPct, 2) }),
  },
  {
    title: '最大回撤',
    key: 'maxDrawdownPct',
    render: (row: any) => h(NTag, { size: 'small', type: drawdownTagType(row.maxDrawdownPct) }, { default: () => metric(Math.abs(Number(row.maxDrawdownPct || 0)), 2) }),
  },
  {
    title: '交易数',
    key: 'totalTrades',
  },
  {
    title: '无交易原因',
    key: 'noTradeReason',
    render: (row: any) => formatNoTradeReason(row),
  },
  {
    title: '胜率',
    key: 'winRatePct',
    render: (row: any) => h(NTag, { size: 'small', type: ratioTagType(row.winRatePct) }, { default: () => metric(row.winRatePct, 2) }),
  },
  {
    title: 'Sharpe',
    key: 'sharpeRatio',
    render: (row: any) => {
      const value = Number(row.sharpeRatio)
      return Number.isFinite(value) ? value.toFixed(3) : '--'
    },
  },
]

const tradeColumns = [
  { title: '策略', key: 'strategyName' },
  { title: '开仓日', key: 'entryDate' },
  { title: '平仓日', key: 'exitDate' },
  {
    title: '开仓价',
    key: 'entryPrice',
    render: (row: any) => money(row.entryPrice, 4),
  },
  {
    title: '平仓价',
    key: 'exitPrice',
    render: (row: any) => money(row.exitPrice, 4),
  },
  { title: '数量', key: 'qty' },
  {
    title: '净收益',
    key: 'netReturnPct',
    render: (row: any) => h(NTag, { size: 'small', type: returnTagType(row.netReturnPct) }, { default: () => metric(row.netReturnPct, 2) }),
  },
  {
    title: '手续费',
    key: 'fees',
    render: (row: any) => money(row.fees, 6),
  },
  { title: '离场原因', key: 'exitReason' },
]

const historyColumns = [
  { title: 'Run Group', key: 'runGroupId' },
  { title: '代码', key: 'code' },
  {
    title: '请求区间',
    key: 'requestedRange',
    render: (row: StrategyRunHistoryItem) => `${row.requestedRange.startDate || '--'} ~ ${row.requestedRange.endDate || '--'}`,
  },
  {
    title: '有效区间',
    key: 'effectiveRange',
    render: (row: StrategyRunHistoryItem) => `${row.effectiveRange.startDate || '--'} ~ ${row.effectiveRange.endDate || '--'}`,
  },
  {
    title: '策略',
    key: 'strategies',
    render: (row: StrategyRunHistoryItem) => row.strategies.map(item => item.strategyName).join(', '),
  },
  {
    title: '创建时间',
    key: 'createdAt',
  },
  {
    title: '操作',
    key: 'actions',
    render: (row: StrategyRunHistoryItem) => h(
      NButton,
      {
        size: 'small',
        tertiary: true,
        onClick: () => loadRunDetail(row.runGroupId),
      },
      { default: () => '查看' },
    ),
  },
]

useEcharts('strategyEquityRef', equityOptions)

onMounted(async () => {
  await loadHistory(1)
})
</script>

<template>
  <n-space vertical :size="SPACING.md">
    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24">
        <n-card title="策略回测（日期区间）" :size="CARD_DENSITY.default">
          <n-space vertical :size="SPACING.md">
            <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner" responsive="screen">
              <n-grid-item :span="24" :m-span="12" :l-span="6">
                <n-input v-model:value="code" placeholder="股票代码（必填）" clearable />
              </n-grid-item>
              <n-grid-item :span="24" :m-span="12" :l-span="10">
                <n-date-picker
                  v-model:value="dateRange"
                  type="daterange"
                  clearable
                  class="w-full"
                  :is-date-disabled="() => false"
                />
              </n-grid-item>
              <n-grid-item :span="24" :m-span="12" :l-span="8">
                <n-checkbox-group v-model:value="strategyCodes">
                  <n-space :size="SPACING.sm" :wrap="true">
                    <n-checkbox v-for="item in strategyOptions" :key="item.code" :value="item.code">
                      {{ item.label }}
                    </n-checkbox>
                  </n-space>
                </n-checkbox-group>
              </n-grid-item>

              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="initialCapital" :min="1" clearable>
                  <template #prefix>
                    初始资金
                  </template>
                </n-input-number>
              </n-grid-item>
              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="commissionRate" :min="0" :max="1" :step="0.0001" clearable>
                  <template #prefix>
                    佣金率
                  </template>
                </n-input-number>
              </n-grid-item>
              <n-grid-item :span="24" :m-span="8" :l-span="8">
                <n-input-number v-model:value="slippageBps" :min="0" :max="1000" :step="0.5" clearable>
                  <template #prefix>
                    滑点(bps)
                  </template>
                </n-input-number>
              </n-grid-item>
            </n-grid>

            <n-space :size="SPACING.sm" :wrap="true">
              <NButton type="primary" :loading="running" @click="runBacktest">
                运行策略回测
              </NButton>
              <NButton secondary :loading="loadingHistory" @click="loadHistory(1)">
                刷新历史
              </NButton>
            </n-space>

            <n-alert type="info" :show-icon="false">
              当前主入口为策略日期区间回测；旧事件回测接口仍保留，并在返回体中标注 <code>legacy_event_backtest=true</code>。
            </n-alert>
            <n-alert v-if="runError" type="error" :show-icon="false">
              {{ runError }}
            </n-alert>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <n-card title="运行摘要" :size="CARD_DENSITY.default">
          <n-empty v-if="!currentRun" description="暂无回测结果" />
          <n-space v-else vertical :size="SPACING.sm">
            <n-descriptions bordered :column="1" size="small" label-placement="left">
              <n-descriptions-item label="Run Group">
                <NTag size="small" type="info">
                  {{ currentRun.runGroupId }}
                </NTag>
              </n-descriptions-item>
              <n-descriptions-item label="代码">
                {{ currentRun.code }}
              </n-descriptions-item>
              <n-descriptions-item label="请求区间">
                {{ currentRun.requestedRange.startDate }} ~ {{ currentRun.requestedRange.endDate }}
              </n-descriptions-item>
              <n-descriptions-item label="有效交易区间">
                {{ currentRun.effectiveRange.startDate }} ~ {{ currentRun.effectiveRange.endDate }}
              </n-descriptions-item>
              <n-descriptions-item label="引擎版本">
                {{ currentRun.engineVersion }}
              </n-descriptions-item>
              <n-descriptions-item label="策略数量">
                {{ currentRun.items.length }}
              </n-descriptions-item>
            </n-descriptions>
            <n-alert v-if="runNoTradeSummary" type="warning" :show-icon="false">
              运行成功，当前区间无成交，原因：{{ runNoTradeSummary }}
            </n-alert>
          </n-space>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="12">
        <n-card title="策略净值曲线" :size="CARD_DENSITY.default">
          <n-spin :show="loadingDetail || running">
            <n-empty v-if="!currentRun || !hasEquityData" description="暂无可绘制曲线" />
            <div v-else ref="strategyEquityRef" :style="{ width: '100%', height: `${CHART_HEIGHT.compactDesktop}px` }" />
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <n-card title="策略指标对比" :size="CARD_DENSITY.default">
          <n-data-table
            size="small"
            :columns="metricsColumns"
            :data="metricsRows"
            :row-key="(row: any) => row.strategyCode"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="12">
        <n-card title="交易明细" :size="CARD_DENSITY.default">
          <n-data-table
            size="small"
            :columns="tradeColumns"
            :data="tradeRows"
            :row-key="(row: any) => `${row.strategyName}-${row.entryDate || ''}-${row.exitDate || ''}-${row.qty || ''}-${row.entryPrice || ''}`"
          />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="历史策略回测记录" :size="CARD_DENSITY.default">
      <n-space vertical :size="SPACING.sm">
        <n-data-table
          size="small"
          :loading="loadingHistory"
          :columns="historyColumns"
          :data="historyRows"
          :row-key="(row: StrategyRunHistoryItem) => row.runGroupId"
        />
        <n-pagination
          :page="historyPage"
          :item-count="historyTotal"
          :page-size="historyPageSize"
          @update:page="(value) => { historyPage = value; loadHistory(value); }"
        />
      </n-space>
    </n-card>
  </n-space>
</template>
