<script setup lang="ts">
import DataSourceBadge from '@/components/common/DataSourceBadge.vue'
import DistributionChart from '@/components/backtest/DistributionChart.vue'
import DrawdownChart from '@/components/backtest/DrawdownChart.vue'
import EquityChart from '@/components/backtest/EquityChart.vue'
import { compareStrategies, fetchBacktestBundle, runBacktestWithRefresh } from '@/services/backtest-service'
import type { BacktestResultItem } from '@/types/backtest'
import type { StrategyCompareItem } from '@/types/backtest-analytics'
import { formatPct } from '@/utils/stock'

const code = ref('')
const evalWindowDays = ref<number | null>(null)
const force = ref(false)

const running = ref(false)
const loading = ref(false)
const loadingPerf = ref(false)
const comparing = ref(false)

const runSummary = ref<{ processed: number, saved: number, completed: number, insufficient: number, errors: number } | null>(null)
const runError = ref('')

const sourceTag = ref<'api' | 'mock' | 'derived'>('api')
const missingApis = ref<string[]>([])
const warnings = ref<string[]>([])

const results = ref<BacktestResultItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const overall = ref<any>(null)
const curves = ref<any[]>([])
const distribution = ref({ longCount: 0, cashCount: 0, winCount: 0, lossCount: 0, neutralCount: 0 })
const maxDrawdownPct = ref<number | null>(null)

const compareWindows = ref<number[]>([5, 10, 20])
const compareRows = ref<StrategyCompareItem[]>([])
const compareError = ref('')

function metric(value?: number | null, digits = 1) {
  if (value == null)
    return '--'
  return `${value.toFixed(digits)}%`
}

async function loadBundle() {
  loading.value = true
  loadingPerf.value = true
  warnings.value = []
  missingApis.value = []

  try {
    const bundle = await fetchBacktestBundle({
      code: code.value.trim() || undefined,
      evalWindowDays: evalWindowDays.value ?? undefined,
      page: page.value,
      limit: pageSize.value,
    })

    sourceTag.value = bundle.dataSource
    missingApis.value = bundle.missingApis
    warnings.value = bundle.warnings

    results.value = bundle.data.results
    total.value = bundle.data.total
    overall.value = bundle.data.overall
    curves.value = bundle.data.analytics.curves
    distribution.value = bundle.data.analytics.distribution
    maxDrawdownPct.value = bundle.data.analytics.maxDrawdownPct
  }
  finally {
    loading.value = false
    loadingPerf.value = false
  }
}

async function run() {
  runError.value = ''
  running.value = true
  try {
    const result = await runBacktestWithRefresh({
      code: code.value.trim() || undefined,
      force: force.value,
      evalWindowDays: evalWindowDays.value ?? undefined,
    })
    runSummary.value = result.data.summary
    await loadBundle()
    window.$message.success('回测执行完成')
  }
  catch (error: unknown) {
    runError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '回测执行失败'
  }
  finally {
    running.value = false
  }
}

async function runCompare() {
  compareError.value = ''
  comparing.value = true
  try {
    const windows = [...new Set(compareWindows.value)]
      .map(item => Number(item))
      .filter(item => Number.isFinite(item) && item > 0)

    if (windows.length === 0) {
      compareError.value = '请至少保留一个策略窗口'
      return
    }

    const result = await compareStrategies(code.value.trim() || undefined, windows)
    compareRows.value = result.data

    if (result.warnings.length > 0)
      window.$message.warning(result.warnings[0])
  }
  catch (error: unknown) {
    compareError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '策略对比失败'
  }
  finally {
    comparing.value = false
  }
}

function buildReportMarkdown() {
  const lines: string[] = []
  lines.push('# 回测报告')
  lines.push('')
  lines.push(`- 代码: ${code.value || '全部'}`)
  lines.push(`- 评估窗口: ${evalWindowDays.value ?? '--'}`)
  lines.push(`- 数据来源: ${sourceTag.value}`)
  lines.push(`- 最大回撤: ${metric(maxDrawdownPct.value, 2)}`)
  lines.push('')
  lines.push('## 总体绩效')
  lines.push(`- 样本数: ${overall.value?.completedCount ?? 0}/${overall.value?.totalEvaluations ?? 0}`)
  lines.push(`- 方向准确率: ${metric(overall.value?.directionAccuracyPct, 2)}`)
  lines.push(`- 胜率: ${metric(overall.value?.winRatePct, 2)}`)
  lines.push(`- 平均模拟收益: ${metric(overall.value?.avgSimulatedReturnPct, 2)}`)
  lines.push('')
  lines.push('## 多策略对比')
  lines.push('| 窗口 | 总样本 | 完成样本 | 方向准确率 | 胜率 | 平均模拟收益 | 最大回撤 |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  compareRows.value.forEach((item) => {
    lines.push(`| ${item.evalWindowDays} | ${item.totalEvaluations} | ${item.completedCount} | ${metric(item.directionAccuracyPct, 2)} | ${metric(item.winRatePct, 2)} | ${metric(item.avgSimulatedReturnPct, 2)} | ${metric(item.maxDrawdownPct, 2)} |`)
  })
  lines.push('')
  lines.push('## 结果记录')
  lines.push(`- 当前页记录数: ${results.value.length}`)
  return lines.join('\n')
}

function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportReport() {
  const ts = new Date()
  const name = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`

  const md = buildReportMarkdown()
  const json = JSON.stringify({
    filters: {
      code: code.value || null,
      evalWindowDays: evalWindowDays.value,
    },
    sourceTag: sourceTag.value,
    warnings: warnings.value,
    summary: overall.value,
    maxDrawdownPct: maxDrawdownPct.value,
    compareRows: compareRows.value,
    results: results.value,
  }, null, 2)

  downloadText(`backtest-report-${name}.md`, md, 'text/markdown')
  downloadText(`backtest-report-${name}.json`, json, 'application/json')
}

const resultColumns = [
  { title: '代码', key: 'code' },
  { title: '分析日期', key: 'analysisDate' },
  { title: '建议', key: 'operationAdvice', ellipsis: { tooltip: true } },
  {
    title: '收益率',
    key: 'simulatedReturnPct',
    render: (row: BacktestResultItem) => formatPct(row.simulatedReturnPct),
  },
  {
    title: '结果',
    key: 'outcome',
    render: (row: BacktestResultItem) => row.outcome || '--',
  },
  {
    title: '状态',
    key: 'evalStatus',
    render: (row: BacktestResultItem) => row.evalStatus,
  },
]

const compareColumns = [
  { title: '窗口', key: 'evalWindowDays' },
  { title: '总样本', key: 'totalEvaluations' },
  { title: '完成样本', key: 'completedCount' },
  { title: '方向准确率', key: 'directionAccuracyPct', render: (row: StrategyCompareItem) => metric(row.directionAccuracyPct, 2) },
  { title: '胜率', key: 'winRatePct', render: (row: StrategyCompareItem) => metric(row.winRatePct, 2) },
  { title: '平均模拟收益', key: 'avgSimulatedReturnPct', render: (row: StrategyCompareItem) => metric(row.avgSimulatedReturnPct, 2) },
  { title: '最大回撤', key: 'maxDrawdownPct', render: (row: StrategyCompareItem) => metric(row.maxDrawdownPct, 2) },
]

onMounted(async () => {
  await loadBundle()
  await runCompare()
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="回测与统计" size="small">
      <n-space justify="space-between" align="center" :wrap="true">
        <n-space align="center" :wrap="true">
          <n-input v-model:value="code" placeholder="股票代码（可选）" clearable style="width: 180px" />
          <n-input-number v-model:value="evalWindowDays" :min="1" :max="120" clearable style="width: 180px">
            <template #prefix>
              评估窗口
            </template>
          </n-input-number>
          <n-switch v-model:value="force">
            <template #checked>
              强制重算
            </template>
            <template #unchecked>
              增量模式
            </template>
          </n-switch>
          <n-button :loading="loading" @click="() => { page = 1; loadBundle(); }">
            刷新
          </n-button>
          <n-button type="primary" :loading="running" @click="run">
            运行回测
          </n-button>
          <n-button :disabled="results.length === 0" @click="exportReport">
            导出报告
          </n-button>
        </n-space>
        <DataSourceBadge :source="sourceTag" :missing-apis="missingApis" />
      </n-space>

      <n-alert v-if="runError" type="error" class="mt-3">
        {{ runError }}
      </n-alert>
      <n-alert v-for="item in warnings" :key="item" type="warning" class="mt-2">
        {{ item }}
      </n-alert>

      <n-descriptions v-if="runSummary" class="mt-3" :column="5" bordered size="small">
        <n-descriptions-item label="处理">
          {{ runSummary.processed }}
        </n-descriptions-item>
        <n-descriptions-item label="保存">
          {{ runSummary.saved }}
        </n-descriptions-item>
        <n-descriptions-item label="完成">
          {{ runSummary.completed }}
        </n-descriptions-item>
        <n-descriptions-item label="数据不足">
          {{ runSummary.insufficient }}
        </n-descriptions-item>
        <n-descriptions-item label="异常">
          {{ runSummary.errors }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="8">
        <n-space vertical :size="16">
          <n-card title="总体绩效" size="small">
            <n-spin :show="loadingPerf">
              <n-empty v-if="!overall" description="暂无绩效数据" />
              <n-descriptions v-else bordered :column="1" size="small">
                <n-descriptions-item label="方向准确率">
                  {{ metric(overall.directionAccuracyPct) }}
                </n-descriptions-item>
                <n-descriptions-item label="胜率">
                  {{ metric(overall.winRatePct) }}
                </n-descriptions-item>
                <n-descriptions-item label="平均模拟收益">
                  {{ metric(overall.avgSimulatedReturnPct) }}
                </n-descriptions-item>
                <n-descriptions-item label="平均标的收益">
                  {{ metric(overall.avgStockReturnPct) }}
                </n-descriptions-item>
                <n-descriptions-item label="最大回撤">
                  {{ metric(maxDrawdownPct, 2) }}
                </n-descriptions-item>
                <n-descriptions-item label="样本数">
                  {{ overall.completedCount }}/{{ overall.totalEvaluations }}
                </n-descriptions-item>
              </n-descriptions>
            </n-spin>
          </n-card>

          <n-card title="交易比例" size="small">
            <DistributionChart :distribution="distribution" />
          </n-card>
        </n-space>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="16">
        <n-card title="收益曲线（策略 vs 标的）" size="small">
          <n-empty v-if="curves.length === 0" description="暂无可绘制曲线的数据" />
          <EquityChart v-else :curves="curves" />
        </n-card>
        <n-card title="回撤曲线" size="small">
          <n-empty v-if="curves.length === 0" description="暂无可绘制回撤的数据" />
          <DrawdownChart v-else :curves="curves" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="多策略对比（5/10/20）" size="small">
      <n-space align="center" :wrap="true">
        <n-checkbox-group v-model:value="compareWindows">
          <n-space>
            <n-checkbox :value="5">
              5
            </n-checkbox>
            <n-checkbox :value="10">
              10
            </n-checkbox>
            <n-checkbox :value="20">
              20
            </n-checkbox>
            <n-checkbox :value="30">
              30
            </n-checkbox>
          </n-space>
        </n-checkbox-group>
        <n-button :loading="comparing" @click="runCompare">
          运行对比
        </n-button>
      </n-space>
      <n-alert v-if="compareError" type="error" class="mt-3">
        {{ compareError }}
      </n-alert>
      <n-data-table class="mt-3" :columns="compareColumns" :data="compareRows" :row-key="(row: StrategyCompareItem) => row.evalWindowDays" />
    </n-card>

    <n-card title="回测结果列表" size="small">
      <n-data-table :loading="loading" :columns="resultColumns" :data="results" :row-key="(row: BacktestResultItem) => `${row.analysisHistoryId}-${row.evalWindowDays}`" />
      <n-pagination
        class="mt-3"
        :page="page"
        :item-count="total"
        :page-size="pageSize"
        @update:page="(value) => { page = value; loadBundle(); }"
      />
    </n-card>
  </n-space>
</template>
