<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { NTag } from 'naive-ui'
import { GRID_GAP, SPACING } from '@/constants/design-tokens'
import { useBrokerAccountStore, useSessionStore, useTradingAccountStore } from '@/store'
import { formatDateTime } from '@/utils/stock'
import { h } from 'vue'

interface ActivityRow {
  id: string
  stockCode: string
  direction: string
  quantity: string
  status: string
  time: string
}

const router = useRouter()
const sessionStore = useSessionStore()
const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const refreshing = ref(false)
const isMobile = useMediaQuery('(max-width: 1024px)')

const simulationStatus = computed(() => brokerAccountStore.simulationStatus)
const canLoadTradingData = computed(() => Boolean(simulationStatus.value?.isBound && simulationStatus.value?.isVerified))
const homeSnapshot = computed(() => tradingAccountStore.homeSnapshot)
const homeKpis = computed(() => tradingAccountStore.homeKpis)
const homeRecentOrders = computed<ActivityRow[]>(() => tradingAccountStore.homeRecentOrders)
const homeRecentTrades = computed<ActivityRow[]>(() => tradingAccountStore.homeRecentTrades)
const userLabel = computed(() => sessionStore.currentUser?.username || '交易员')

const dashboardError = computed(() => {
  return brokerAccountStore.error || tradingAccountStore.overviewError || tradingAccountStore.detailsError
})

const accountStateLabel = computed(() => {
  if (!simulationStatus.value?.isBound)
    return '未初始化'
  if (!simulationStatus.value?.isVerified)
    return '待校验'
  return '已就绪'
})

const accountStateType = computed<'success' | 'warning'>(() => {
  if (!simulationStatus.value?.isBound || !simulationStatus.value?.isVerified)
    return 'warning'
  return 'success'
})

const overviewHint = computed(() => {
  if (!simulationStatus.value?.isBound)
    return '请先初始化本地 Backtrader 模拟账户。'
  if (!simulationStatus.value?.isVerified)
    return '账户尚未校验，当前可浏览数据但不可自动下单。'
  if (dashboardError.value)
    return dashboardError.value
  return '数据源已连接，可快速进入分析与交易流程。'
})

const marketValueForRatio = computed(() => {
  if (homeKpis.value.marketValue != null)
    return Math.max(homeKpis.value.marketValue, 0)
  const totalAsset = homeKpis.value.totalAsset ?? 0
  const cash = homeKpis.value.cash ?? 0
  return Math.max(totalAsset - cash, 0)
})

const ratioTotal = computed(() => {
  const cash = Math.max(homeKpis.value.cash ?? 0, 0)
  const market = Math.max(marketValueForRatio.value, 0)
  if (cash + market > 0)
    return cash + market
  return Math.max(homeKpis.value.totalAsset ?? 0, 0)
})

const cashRatio = computed(() => {
  const total = ratioTotal.value
  if (total <= 0)
    return 0
  return Math.min(100, Math.max(0, Number((((homeKpis.value.cash ?? 0) / total) * 100).toFixed(1))))
})

const marketRatio = computed(() => {
  const total = ratioTotal.value
  if (total <= 0)
    return 0
  return Math.min(100, Math.max(0, Number(((marketValueForRatio.value / total) * 100).toFixed(1))))
})

function trendValueStyle(value: number | null | undefined) {
  if (value == null)
    return undefined
  if (value > 0)
    return { color: 'var(--n-success-color)' }
  if (value < 0)
    return { color: 'var(--n-error-color)' }
  return undefined
}

const pnlDailyStyle = computed(() => trendValueStyle(homeKpis.value.pnlDaily))
const pnlTotalStyle = computed(() => trendValueStyle(homeKpis.value.pnlTotal))
const returnPctStyle = computed(() => trendValueStyle(homeKpis.value.returnPct))

function directionTagType(direction: string): 'success' | 'warning' | 'info' | 'default' {
  const value = direction.toLowerCase()
  if (value.includes('买') || value.includes('buy'))
    return 'success'
  if (value.includes('卖') || value.includes('sell'))
    return 'warning'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}

function statusTagType(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const value = status.toLowerCase()
  if (value.includes('成') || value.includes('filled') || value.includes('success'))
    return 'success'
  if (value.includes('待') || value.includes('提交') || value.includes('pending'))
    return 'warning'
  if (value.includes('拒') || value.includes('fail') || value.includes('error'))
    return 'error'
  if (value.includes('撤') || value.includes('cancel'))
    return 'info'
  return 'default'
}

const activityColumns: DataTableColumns<ActivityRow> = [
  {
    title: '标的',
    key: 'stockCode',
    minWidth: 120,
    ellipsis: { tooltip: true },
  },
  {
    title: '方向',
    key: 'direction',
    width: 100,
    render: row => h(
      NTag,
      { size: 'small', type: directionTagType(row.direction) },
      { default: () => row.direction },
    ),
  },
  {
    title: '数量',
    key: 'quantity',
    width: 100,
  },
  {
    title: '状态',
    key: 'status',
    minWidth: 110,
    render: row => h(
      NTag,
      { size: 'small', type: statusTagType(row.status) },
      { default: () => row.status },
    ),
  },
  {
    title: '时间',
    key: 'time',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
]

function openBindModal() {
  brokerAccountStore.openBindModal()
}

function toAnalysis() {
  router.push('/analysis/center')
}

function toTradingCenter() {
  router.push('/profile/trading')
}

async function loadDashboard(refresh = false, silent = false) {
  refreshing.value = true
  try {
    await brokerAccountStore.loadSimulationStatus()

    if (canLoadTradingData.value) {
      const result = await tradingAccountStore.loadAll({ refresh })
      if (!result.success && !silent && result.error && result.error !== 'stale_request')
        window.$message.error(result.error)
    }
    else {
      tradingAccountStore.clearData()
    }
  }
  catch {
    if (!silent)
      window.$message.error(brokerAccountStore.error || '加载首页数据失败')
  }
  finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await loadDashboard(false, true)
})
</script>

<template>
  <n-space vertical :size="SPACING.lg">
    <n-grid :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="16">
        <n-card title="账户总览">
          <template #header-extra>
            <NTag :type="accountStateType">
              {{ accountStateLabel }}
            </NTag>
          </template>

          <n-space vertical :size="SPACING.lg">
            <n-text depth="3">
              欢迎回来，{{ userLabel }}。{{ overviewHint }}
            </n-text>

            <template v-if="!isMobile">
              <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner">
                <n-grid-item :span="6">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      总资产（CNY）
                    </n-text>
                    <n-statistic :value="homeKpis.totalAsset ?? 0" :precision="2" />
                    <n-text v-if="homeKpis.totalAsset == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="6">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      当日盈亏
                    </n-text>
                    <n-statistic :value="homeKpis.pnlDaily ?? 0" :precision="2" :value-style="pnlDailyStyle" />
                    <n-text v-if="homeKpis.pnlDaily == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="6">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      累计盈亏
                    </n-text>
                    <n-statistic :value="homeKpis.pnlTotal ?? 0" :precision="2" :value-style="pnlTotalStyle" />
                    <n-text v-if="homeKpis.pnlTotal == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="6">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      收益率
                    </n-text>
                    <n-statistic :value="homeKpis.returnPct ?? 0" :precision="2" :value-style="returnPctStyle">
                      <template #suffix>
                        %
                      </template>
                    </n-statistic>
                    <n-text v-if="homeKpis.returnPct == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>
              </n-grid>

              <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner">
                <n-grid-item :span="12">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.md">
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">
                          现金占比
                        </n-text>
                        <n-text>{{ cashRatio }}%</n-text>
                      </n-space>
                      <n-progress type="dashboard" :percentage="cashRatio" status="info" :gap-degree="120" />
                      <n-statistic label="可用现金" :value="homeKpis.cash ?? 0" :precision="2" />
                      <n-text v-if="homeKpis.cash == null" depth="3">
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="12">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.md">
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">
                          持仓占比
                        </n-text>
                        <n-text>{{ marketRatio }}%</n-text>
                      </n-space>
                      <n-progress type="dashboard" :percentage="marketRatio" status="success" :gap-degree="120" />
                      <n-statistic label="持仓市值" :value="marketValueForRatio" :precision="2" />
                    </n-space>
                  </n-card>
                </n-grid-item>
              </n-grid>
            </template>

            <template v-else>
              <n-grid :cols="24" :x-gap="GRID_GAP.inner" :y-gap="GRID_GAP.inner">
                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      总资产（CNY）
                    </n-text>
                    <n-statistic :value="homeKpis.totalAsset ?? 0" :precision="2" />
                    <n-text v-if="homeKpis.totalAsset == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      当日盈亏
                    </n-text>
                    <n-statistic :value="homeKpis.pnlDaily ?? 0" :precision="2" :value-style="pnlDailyStyle" />
                    <n-text v-if="homeKpis.pnlDaily == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      累计盈亏
                    </n-text>
                    <n-statistic :value="homeKpis.pnlTotal ?? 0" :precision="2" :value-style="pnlTotalStyle" />
                    <n-text v-if="homeKpis.pnlTotal == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-text depth="3">
                      收益率
                    </n-text>
                    <n-statistic :value="homeKpis.returnPct ?? 0" :precision="2" :value-style="returnPctStyle">
                      <template #suffix>
                        %
                      </template>
                    </n-statistic>
                    <n-text v-if="homeKpis.returnPct == null" depth="3">
                      --
                    </n-text>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.md">
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">
                          现金占比
                        </n-text>
                        <n-text>{{ cashRatio }}%</n-text>
                      </n-space>
                      <n-progress type="dashboard" :percentage="cashRatio" status="info" :gap-degree="120" />
                      <n-statistic label="可用现金" :value="homeKpis.cash ?? 0" :precision="2" />
                      <n-text v-if="homeKpis.cash == null" depth="3">
                        --
                      </n-text>
                    </n-space>
                  </n-card>
                </n-grid-item>

                <n-grid-item :span="24">
                  <n-card embedded size="small">
                    <n-space vertical :size="SPACING.md">
                      <n-space justify="space-between" align="center">
                        <n-text depth="3">
                          持仓占比
                        </n-text>
                        <n-text>{{ marketRatio }}%</n-text>
                      </n-space>
                      <n-progress type="dashboard" :percentage="marketRatio" status="success" :gap-degree="120" />
                      <n-statistic label="持仓市值" :value="marketValueForRatio" :precision="2" />
                    </n-space>
                  </n-card>
                </n-grid-item>
              </n-grid>
            </template>
          </n-space>
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="8">
        <n-card title="状态与操作">
          <n-space vertical :size="SPACING.md">
            <n-descriptions :column="1" bordered size="small" label-placement="left">
              <n-descriptions-item label="账户">
                {{ homeSnapshot.accountLabel }}
              </n-descriptions-item>
              <n-descriptions-item label="提供方">
                {{ homeSnapshot.providerLabel }}
              </n-descriptions-item>
              <n-descriptions-item label="来源">
                {{ homeSnapshot.dataSource }}
              </n-descriptions-item>
              <n-descriptions-item label="最近同步">
                {{ homeSnapshot.snapshotAt ? formatDateTime(homeSnapshot.snapshotAt) : '--' }}
              </n-descriptions-item>
            </n-descriptions>

            <n-alert :type="accountStateType" :show-icon="false">
              账户状态：{{ accountStateLabel }}
            </n-alert>

            <n-alert v-if="dashboardError" type="error" :show-icon="false">
              {{ dashboardError }}
            </n-alert>

            <n-space :size="SPACING.sm" :wrap="true">
              <n-button type="primary" :loading="refreshing" @click="loadDashboard(true)">
                刷新数据
              </n-button>
              <n-button secondary @click="toAnalysis">
                进入分析中心
              </n-button>
              <n-button tertiary @click="toTradingCenter">
                交易账户中心
              </n-button>
              <n-button
                v-if="!simulationStatus?.isBound || !simulationStatus?.isVerified"
                text
                type="warning"
                @click="openBindModal"
              >
                初始化账户
              </n-button>
            </n-space>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid v-if="!isMobile" :cols="24" :x-gap="GRID_GAP.outer" :y-gap="GRID_GAP.outer" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <n-card title="近期委托">
          <n-empty v-if="!homeRecentOrders.length" description="暂无委托数据" />
          <n-data-table
            v-else
            size="small"
            :columns="activityColumns"
            :data="homeRecentOrders"
            :bordered="false"
            :pagination="false"
            :row-key="(row: ActivityRow) => row.id"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="12">
        <n-card title="近期成交">
          <n-empty v-if="!homeRecentTrades.length" description="暂无成交数据" />
          <n-data-table
            v-else
            size="small"
            :columns="activityColumns"
            :data="homeRecentTrades"
            :bordered="false"
            :pagination="false"
            :row-key="(row: ActivityRow) => row.id"
          />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-space v-else vertical :size="SPACING.lg">
      <n-card title="近期委托">
        <n-empty v-if="!homeRecentOrders.length" description="暂无委托数据" />
        <n-list v-else hoverable>
          <n-list-item v-for="item in homeRecentOrders" :key="item.id">
            <n-space vertical :size="SPACING.sm">
              <n-space justify="space-between" align="center">
                <n-text strong>
                  {{ item.stockCode }}
                </n-text>
                <NTag size="small" :type="directionTagType(item.direction)">
                  {{ item.direction }}
                </NTag>
              </n-space>
              <n-space :size="SPACING.sm" :wrap="true">
                <NTag size="small" :type="statusTagType(item.status)">
                  {{ item.status }}
                </NTag>
                <n-text depth="3">
                  数量：{{ item.quantity }}
                </n-text>
                <n-text depth="3">
                  {{ item.time }}
                </n-text>
              </n-space>
            </n-space>
          </n-list-item>
        </n-list>
      </n-card>

      <n-card title="近期成交">
        <n-empty v-if="!homeRecentTrades.length" description="暂无成交数据" />
        <n-list v-else hoverable>
          <n-list-item v-for="item in homeRecentTrades" :key="item.id">
            <n-space vertical :size="SPACING.sm">
              <n-space justify="space-between" align="center">
                <n-text strong>
                  {{ item.stockCode }}
                </n-text>
                <NTag size="small" :type="directionTagType(item.direction)">
                  {{ item.direction }}
                </NTag>
              </n-space>
              <n-space :size="SPACING.sm" :wrap="true">
                <NTag size="small" :type="statusTagType(item.status)">
                  {{ item.status }}
                </NTag>
                <n-text depth="3">
                  数量：{{ item.quantity }}
                </n-text>
                <n-text depth="3">
                  {{ item.time }}
                </n-text>
              </n-space>
            </n-space>
          </n-list-item>
        </n-list>
      </n-card>
    </n-space>
  </n-space>
</template>
