<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { addTradingFunds } from '@/api/trading-account'
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'
import { formatDateTime, formatPct } from '@/utils/stock'

const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const forcingRefresh = ref(false)
const binding = ref(false)
const funding = ref(false)
const failedWithHistoricalAccountUid = ref(false)

const bindForm = reactive({
  accountUid: '',
  accountDisplayName: '',
  initialCapital: 100000,
  commissionRate: 0.0003,
  slippageBps: 2,
})

const addFundsForm = reactive({
  amount: 10000,
  note: '',
})

const simulationStatus = computed(() => brokerAccountStore.simulationStatus)
const overviewMeta = computed(() => tradingAccountStore.performance || tradingAccountStore.summary)
const hasHistoricalAccountUid = computed(() => {
  const statusAccountUid = simulationStatus.value?.accountUid?.trim()
  return Boolean(statusAccountUid && bindForm.accountUid.trim() && bindForm.accountUid.trim() === statusAccountUid)
})
const bindInlineError = computed(() => brokerAccountStore.bindError || brokerAccountStore.error)

const accountStatusText = computed(() => {
  if (!simulationStatus.value?.isBound)
    return '未初始化模拟账户'
  if (!simulationStatus.value?.isVerified)
    return '模拟账户待校验'
  return '模拟账户已就绪'
})

function toNumber(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n))
    return null
  return n
}

const overviewMetrics = computed(() => {
  const summary = tradingAccountStore.summary?.summary || {}
  const performance = tradingAccountStore.performance?.performance || {}

  const pick = (...values: unknown[]) => {
    for (const value of values) {
      const parsed = toNumber(value)
      if (parsed != null)
        return parsed
    }
    return null
  }

  return {
    totalAsset: pick(performance.totalAsset, summary.totalAsset, summary.totalEquity),
    cash: pick(performance.cash, summary.cash, summary.availableCash),
    marketValue: pick(performance.marketValue, summary.marketValue, summary.totalMarketValue),
    pnlDaily: pick(performance.pnlDaily, summary.pnlDaily, summary.dailyPnl, summary.todayPnl),
    pnlTotal: pick(performance.pnlTotal, summary.pnlTotal, summary.totalPnl, summary.profitTotal),
    returnPct: pick(performance.returnPct, summary.returnPct, summary.totalReturnPct, summary.profitRate),
  }
})

const canLoadTradingData = computed(() => {
  return Boolean(simulationStatus.value?.isBound && simulationStatus.value?.isVerified)
})

function formatAmount(value: number | null | undefined): string {
  if (value == null)
    return '--'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function renderCell(value: unknown): string {
  if (value == null)
    return '--'
  if (typeof value === 'object')
    return JSON.stringify(value)
  return String(value)
}

function buildDynamicColumns(items: Array<Record<string, unknown>>): DataTableColumns<Record<string, unknown>> {
  if (!items.length)
    return []
  return Object.keys(items[0]).slice(0, 12).map((key) => {
    return {
      title: key,
      key,
      render: row => renderCell(row[key]),
    }
  })
}

const positionsColumns = computed(() => buildDynamicColumns(tradingAccountStore.positions?.items || []))
const ordersColumns = computed(() => buildDynamicColumns(tradingAccountStore.orders?.items || []))
const tradesColumns = computed(() => buildDynamicColumns(tradingAccountStore.trades?.items || []))

function validateBindForm(): string | null {
  if (!Number.isFinite(bindForm.initialCapital) || bindForm.initialCapital <= 0)
    return '初始资金必须大于 0'
  if (!Number.isFinite(bindForm.commissionRate) || bindForm.commissionRate < 0)
    return '手续费率必须大于等于 0'
  if (!Number.isFinite(bindForm.slippageBps) || bindForm.slippageBps < 0)
    return '滑点(bps)必须大于等于 0'
  return null
}

function validateAddFundsForm(): string | null {
  if (!Number.isFinite(addFundsForm.amount) || Number(addFundsForm.amount) <= 0)
    return '增加资金金额必须大于 0'
  return null
}

async function loadSimulationStatus(silent = false): Promise<boolean> {
  try {
    await brokerAccountStore.loadSimulationStatus()
    syncBindFormFromStatus()
    return true
  }
  catch {
    if (!silent)
      window.$message.error(brokerAccountStore.error || '加载模拟盘账户状态失败')
    return false
  }
}

async function refreshTradingData(refresh = false, silent = false): Promise<void> {
  if (!canLoadTradingData.value) {
    tradingAccountStore.clearData()
    return
  }

  const result = await tradingAccountStore.loadAll({ refresh })
  if (!result.success && !silent && result.error && result.error !== 'stale_request')
    window.$message.error(result.error)
}

async function loadStatusAndData(silent = false): Promise<void> {
  const ok = await loadSimulationStatus(silent)
  if (!ok)
    return
  await refreshTradingData(false, silent)
}

function syncBindFormFromStatus() {
  const status = simulationStatus.value
  if (!bindForm.accountUid.trim() && status?.accountUid) {
    bindForm.accountUid = status.accountUid
  }
  if (!bindForm.accountDisplayName.trim() && status?.accountDisplayName) {
    bindForm.accountDisplayName = status.accountDisplayName
  }
}

function clearAccountUidInput() {
  bindForm.accountUid = ''
}

async function bindSimulationAccountNow() {
  brokerAccountStore.clearBindError()
  failedWithHistoricalAccountUid.value = false

  const validationError = validateBindForm()
  if (validationError) {
    window.$message.error(validationError)
    return
  }

  binding.value = true
  try {
    await brokerAccountStore.bindSimulation({
      accountUid: bindForm.accountUid.trim() || undefined,
      accountDisplayName: bindForm.accountDisplayName.trim() || undefined,
      initialCapital: Number(bindForm.initialCapital),
      commissionRate: Number(bindForm.commissionRate),
      slippageBps: Number(bindForm.slippageBps),
    })
    await refreshTradingData(true, true)
    window.$message.success('Backtrader 模拟账户初始化成功')
  }
  catch {
    if (hasHistoricalAccountUid.value)
      failedWithHistoricalAccountUid.value = true
    window.$message.error(brokerAccountStore.error || '模拟盘初始化失败')
  }
  finally {
    binding.value = false
  }
}

function extractActionError(error: unknown, fallback: string): string {
  const payload = error as { response?: { data?: { message?: string } } }
  const message = String(payload?.response?.data?.message ?? '').trim()
  return message || fallback
}

async function addFundsNow() {
  const validationError = validateAddFundsForm()
  if (validationError) {
    window.$message.error(validationError)
    return
  }

  funding.value = true
  try {
    await addTradingFunds({
      amount: Number(addFundsForm.amount),
      note: addFundsForm.note.trim() || undefined,
    })
    await refreshTradingData(true, true)
    window.$message.success('增加资金成功，账户快照已更新')
    addFundsForm.note = ''
  }
  catch (error: unknown) {
    window.$message.error(extractActionError(error, '增加资金失败'))
  }
  finally {
    funding.value = false
  }
}

onMounted(async () => {
  await loadStatusAndData(true)
})

watch(() => bindForm.accountUid, () => {
  if (!hasHistoricalAccountUid.value)
    failedWithHistoricalAccountUid.value = false
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="交易账户中心">
      <template #header-extra>
        <n-tag :type="simulationStatus?.isBound && simulationStatus?.isVerified ? 'success' : 'warning'">
          {{ accountStatusText }}
        </n-tag>
      </template>

      <n-space vertical :size="12">
        <n-text depth="3">
          管理 Backtrader 本地模拟账户的初始化参数、资金概览与交易明细。
        </n-text>

        <n-space :wrap="true" align="center">
          <n-button :loading="brokerAccountStore.loading" @click="loadStatusAndData()">
            刷新状态
          </n-button>
          <n-button :loading="tradingAccountStore.loadingOverview || tradingAccountStore.loadingDetails" @click="refreshTradingData(forcingRefresh)">
            刷新交易数据
          </n-button>
          <n-switch v-model:value="forcingRefresh">
            <template #checked>
              强制上游刷新
            </template>
            <template #unchecked>
              缓存优先
            </template>
          </n-switch>
        </n-space>

        <n-descriptions :column="2" bordered>
          <n-descriptions-item label="最近校验">
            {{ simulationStatus?.lastVerifiedAt ? formatDateTime(simulationStatus?.lastVerifiedAt) : '--' }}
          </n-descriptions-item>
          <n-descriptions-item label="最近同步">
            {{ tradingAccountStore.lastLoadedAt ? formatDateTime(tradingAccountStore.lastLoadedAt) : '--' }}
          </n-descriptions-item>
        </n-descriptions>
      </n-space>
    </n-card>

    <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="13">
        <n-card title="初始化/更新模拟账户参数">
          <n-form label-placement="top">
            <n-grid :cols="24" :x-gap="12" :y-gap="4" responsive="screen">
              <n-grid-item :span="24" :l-span="12">
                <n-form-item label="账户标识（可选）">
                  <n-input v-model:value="bindForm.accountUid" placeholder="留空则自动生成，例如 bt-user-1" />
                </n-form-item>
                <n-space vertical :size="4">
                  <n-text depth="3" class="text-12px">
                    默认值来自你上次初始化记录，可直接修改。
                  </n-text>
                  <n-button v-if="bindForm.accountUid" text size="small" @click="clearAccountUidInput">
                    {{ hasHistoricalAccountUid ? '清空历史标识' : '清空输入' }}
                  </n-button>
                </n-space>
              </n-grid-item>

              <n-grid-item :span="24" :l-span="12">
                <n-form-item label="显示名（可选）">
                  <n-input v-model:value="bindForm.accountDisplayName" placeholder="例如：我的本地模拟盘" />
                </n-form-item>
              </n-grid-item>

              <n-grid-item :span="24" :l-span="8">
                <n-form-item label="初始资金">
                  <n-input-number
                    v-model:value="bindForm.initialCapital"
                    :min="1"
                    :step="1000"
                    class="w-full"
                    placeholder="例如：100000"
                  />
                </n-form-item>
              </n-grid-item>

              <n-grid-item :span="24" :l-span="8">
                <n-form-item label="手续费率">
                  <n-input-number
                    v-model:value="bindForm.commissionRate"
                    :min="0"
                    :step="0.0001"
                    :precision="6"
                    class="w-full"
                    placeholder="例如：0.0003"
                  />
                </n-form-item>
              </n-grid-item>

              <n-grid-item :span="24" :l-span="8">
                <n-form-item label="滑点（bps）">
                  <n-input-number
                    v-model:value="bindForm.slippageBps"
                    :min="0"
                    :step="0.5"
                    :precision="2"
                    class="w-full"
                    placeholder="例如：2"
                  />
                </n-form-item>
              </n-grid-item>
            </n-grid>

            <n-space>
              <n-tag type="default">
                提供方：Backtrader Local Sim
              </n-tag>
            </n-space>
            <n-alert v-if="bindInlineError" type="error">
              {{ bindInlineError }}
            </n-alert>
            <n-alert v-if="failedWithHistoricalAccountUid" type="warning" :show-icon="false">
              请确认当前填写的账户标识不是旧的历史 ID。
            </n-alert>
            <n-space justify="end">
              <n-button type="primary" :loading="binding || brokerAccountStore.submitting" @click="bindSimulationAccountNow">
                初始化并校验
              </n-button>
            </n-space>
          </n-form>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="13">
        <n-card title="增加资金">
          <n-space vertical :size="12">
            <n-text depth="3">
              仅支持正向入金。提交后会实时同步到前端概览、Backend 账户快照、Agent 运行上下文与 LLM 分析约束。
            </n-text>

            <n-empty
              v-if="!canLoadTradingData"
              description="初始化并校验模拟盘账户后可增加资金"
            />
            <n-form v-else label-placement="top">
              <n-grid :cols="24" :x-gap="12" :y-gap="4" responsive="screen">
                <n-grid-item :span="24" :m-span="10">
                  <n-form-item label="增加金额">
                    <n-input-number
                      v-model:value="addFundsForm.amount"
                      :min="0.01"
                      :step="1000"
                      :precision="2"
                      class="w-full"
                      placeholder="例如：10000"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="14">
                  <n-form-item label="备注（可选）">
                    <n-input
                      v-model:value="addFundsForm.note"
                      maxlength="200"
                      show-count
                      placeholder="例如：策略追加资金"
                    />
                  </n-form-item>
                </n-grid-item>
              </n-grid>

              <n-space justify="end">
                <n-button type="primary" :loading="funding" @click="addFundsNow">
                  确认增加资金
                </n-button>
              </n-space>
            </n-form>
          </n-space>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="11">
        <n-card title="资金与收益概览">
          <n-spin :show="tradingAccountStore.loadingOverview">
            <n-empty
              v-if="!simulationStatus?.isBound"
              description="未初始化模拟盘账户，请先完成初始化"
            />
            <n-empty
              v-else-if="!simulationStatus?.isVerified"
              description="模拟盘账户尚未校验，请先执行初始化并校验"
            />
            <template v-else>
              <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
                <n-grid-item :span="24" :m-span="12">
                  <n-card embedded>
                    <n-statistic label="总资产" :value="overviewMetrics.totalAsset || 0" :precision="2" />
                  </n-card>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-card embedded>
                    <n-statistic label="可用现金" :value="overviewMetrics.cash || 0" :precision="2" />
                  </n-card>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-card embedded>
                    <n-statistic label="当日盈亏" :value="overviewMetrics.pnlDaily || 0" :precision="2" />
                  </n-card>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-card embedded>
                    <n-statistic :value="overviewMetrics.returnPct || 0" :precision="2" label="收益率">
                      <template #suffix>
                        %
                      </template>
                    </n-statistic>
                  </n-card>
                </n-grid-item>
              </n-grid>

              <n-space align="center" :wrap="true">
                <n-tag v-if="overviewMeta?.dataSource" type="default">
                  来源：{{ overviewMeta?.dataSource }}
                </n-tag>
                <n-tag v-if="overviewMeta?.providerName || overviewMeta?.providerCode" type="default">
                  提供方：{{ overviewMeta?.providerName || overviewMeta?.providerCode }}
                </n-tag>
                <n-tag v-if="overviewMeta?.orderChannel" type="default">
                  通道：{{ overviewMeta?.orderChannel }}
                </n-tag>
                <n-text depth="3">
                  快照：{{ overviewMeta?.snapshotAt ? formatDateTime(overviewMeta?.snapshotAt) : '--' }}
                </n-text>
              </n-space>

              <n-alert v-if="tradingAccountStore.overviewError" type="error">
                {{ tradingAccountStore.overviewError }}
              </n-alert>
            </template>
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="交易明细">
      <n-spin :show="tradingAccountStore.loadingDetails">
        <n-empty
          v-if="!canLoadTradingData"
          description="初始化并校验模拟盘账户后可查看持仓、委托和成交明细"
        />
        <template v-else>
          <n-tabs type="line" animated>
            <n-tab-pane name="positions" tab="持仓">
              <n-empty v-if="!tradingAccountStore.positions || (tradingAccountStore.positions.total || 0) === 0" description="暂无持仓数据" />
              <n-data-table
                v-else
                size="small"
                :columns="positionsColumns"
                :data="tradingAccountStore.positions.items"
                :single-line="false"
              />
            </n-tab-pane>
            <n-tab-pane name="orders" tab="委托">
              <n-empty v-if="!tradingAccountStore.orders || (tradingAccountStore.orders.total || 0) === 0" description="暂无委托数据" />
              <n-data-table
                v-else
                size="small"
                :columns="ordersColumns"
                :data="tradingAccountStore.orders.items"
                :single-line="false"
              />
            </n-tab-pane>
            <n-tab-pane name="trades" tab="成交">
              <n-empty v-if="!tradingAccountStore.trades || (tradingAccountStore.trades.total || 0) === 0" description="暂无成交数据" />
              <n-data-table
                v-else
                size="small"
                :columns="tradesColumns"
                :data="tradingAccountStore.trades.items"
                :single-line="false"
              />
            </n-tab-pane>
          </n-tabs>
          <n-alert v-if="tradingAccountStore.detailsError" type="error">
            {{ tradingAccountStore.detailsError }}
          </n-alert>
        </template>
      </n-spin>
    </n-card>

    <n-card v-if="simulationStatus?.isVerified">
      <n-descriptions :column="3" bordered>
        <n-descriptions-item label="总资产(格式化)">
          {{ formatAmount(overviewMetrics.totalAsset) }}
        </n-descriptions-item>
        <n-descriptions-item label="可用现金(格式化)">
          {{ formatAmount(overviewMetrics.cash) }}
        </n-descriptions-item>
        <n-descriptions-item label="收益率(格式化)">
          {{ formatPct(overviewMetrics.returnPct, 2) }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
  </n-space>
</template>
