<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { BrokerAccountItem, BrokerAccountStatus } from '@/types/broker-account'
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'
import { formatDateTime, formatPct } from '@/utils/stock'

const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const selectedRowId = ref<number | null>(null)
const forcingRefresh = ref(false)

const createVisible = ref(false)
const editVisible = ref(false)
const submitting = ref(false)

const createForm = reactive({
  brokerCode: 'futu',
  environment: 'paper',
  accountUid: '',
  accountDisplayName: '',
  credentialsText: '{\n  \n}',
})

const editForm = reactive({
  id: 0,
  accountDisplayName: '',
  status: 'active' as BrokerAccountStatus,
  updateCredentials: false,
  credentialsText: '{\n  \n}',
})

const selectedAccountId = computed<number | null>({
  get() {
    return brokerAccountStore.selectedAccountId
  },
  set(value) {
    brokerAccountStore.setSelectedAccount(value)
  },
})

const activeAccountOptions = computed(() => {
  return brokerAccountStore.activeAccounts.map(item => ({
    label: `${item.accountDisplayName || item.accountUid} (${item.brokerCode})${item.isVerified ? '' : ' · 未校验'}`,
    value: item.id,
  }))
})

const currentSelectedRow = computed(() => {
  if (!selectedRowId.value)
    return null
  return brokerAccountStore.items.find(item => item.id === selectedRowId.value) || null
})

const currentTradingAccount = computed(() => brokerAccountStore.selectedAccount)

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

const overviewMeta = computed(() => {
  return tradingAccountStore.performance || tradingAccountStore.summary
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

const accountColumns: DataTableColumns<BrokerAccountItem> = [
  { title: 'ID', key: 'id' },
  { title: '券商', key: 'brokerCode' },
  { title: '账户UID', key: 'accountUid' },
  {
    title: '显示名',
    key: 'accountDisplayName',
    render: row => row.accountDisplayName || '--',
  },
  { title: '状态', key: 'status' },
  {
    title: '校验状态',
    key: 'isVerified',
    render: row => (row.isVerified ? '已校验' : '未校验'),
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    render: row => formatDateTime(row.updatedAt),
  },
]

const positionsColumns = computed(() => buildDynamicColumns(tradingAccountStore.positions?.items || []))
const ordersColumns = computed(() => buildDynamicColumns(tradingAccountStore.orders?.items || []))
const tradesColumns = computed(() => buildDynamicColumns(tradingAccountStore.trades?.items || []))

function parseCredentials(text: string): { valid: boolean, data?: Record<string, unknown>, message?: string } {
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        message: '凭据必须是 JSON 对象',
      }
    }
    if (Object.keys(parsed).length === 0) {
      return {
        valid: false,
        message: '凭据对象不能为空',
      }
    }
    return {
      valid: true,
      data: parsed as Record<string, unknown>,
    }
  }
  catch {
    return {
      valid: false,
      message: '凭据 JSON 格式无效',
    }
  }
}

async function loadAccounts() {
  try {
    await brokerAccountStore.loadAccounts()
    if (selectedRowId.value == null && brokerAccountStore.items.length > 0)
      selectedRowId.value = brokerAccountStore.items[0].id
  }
  catch {
    window.$message.error(brokerAccountStore.error || '加载券商账户失败')
  }
}

async function loadTradingData(refresh = false, notifyError = true) {
  const result = await tradingAccountStore.loadAll({
    brokerAccountId: selectedAccountId.value,
    refresh,
  })

  if (!result.success && notifyError && result.error && result.error !== 'stale_request') {
    window.$message.error(result.error)
  }
}

function openCreate() {
  createForm.brokerCode = 'futu'
  createForm.environment = 'paper'
  createForm.accountUid = ''
  createForm.accountDisplayName = ''
  createForm.credentialsText = '{\n  \n}'
  createVisible.value = true
}

function openEdit() {
  const row = currentSelectedRow.value
  if (!row) {
    window.$message.warning('请先在表格中选择一个账户')
    return
  }

  editForm.id = row.id
  editForm.accountDisplayName = row.accountDisplayName || ''
  editForm.status = row.status
  editForm.updateCredentials = false
  editForm.credentialsText = '{\n  \n}'
  editVisible.value = true
}

async function submitCreate() {
  if (!createForm.brokerCode.trim()) {
    window.$message.error('券商代码不能为空')
    return
  }
  if (!createForm.accountUid.trim()) {
    window.$message.error('账户UID不能为空')
    return
  }

  const parsed = parseCredentials(createForm.credentialsText)
  if (!parsed.valid) {
    window.$message.error(parsed.message || '凭据格式错误')
    return
  }

  submitting.value = true
  try {
    const created = await brokerAccountStore.createAccount({
      brokerCode: createForm.brokerCode.trim(),
      environment: 'paper',
      accountUid: createForm.accountUid.trim(),
      accountDisplayName: createForm.accountDisplayName.trim() || undefined,
      credentials: parsed.data!,
    })
    createVisible.value = false
    selectedRowId.value = created.id
    await loadTradingData(false, false)
    window.$message.success('账户创建成功')
  }
  catch {
    window.$message.error(brokerAccountStore.error || '创建账户失败')
  }
  finally {
    submitting.value = false
  }
}

async function submitEdit() {
  submitting.value = true
  try {
    let credentials: Record<string, unknown> | undefined
    if (editForm.updateCredentials) {
      const parsed = parseCredentials(editForm.credentialsText)
      if (!parsed.valid) {
        window.$message.error(parsed.message || '凭据格式错误')
        return
      }
      credentials = parsed.data
    }

    await brokerAccountStore.updateAccount(editForm.id, {
      accountDisplayName: editForm.accountDisplayName.trim() || undefined,
      status: editForm.status,
      ...(credentials
        ? {
            credentials,
          }
        : {}),
    })
    editVisible.value = false
    await loadTradingData(false, false)
    window.$message.success('账户更新成功')
  }
  catch {
    window.$message.error(brokerAccountStore.error || '更新账户失败')
  }
  finally {
    submitting.value = false
  }
}

function verifyCurrent() {
  const row = currentSelectedRow.value
  if (!row) {
    window.$message.warning('请先选择账户')
    return
  }
  if (row.status !== 'active') {
    window.$message.warning('请先启用该账户后再校验')
    return
  }

  window.$dialog.info({
    title: '账户校验',
    content: `确认校验账户 ${row.accountUid} 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await brokerAccountStore.verifyAccount(row.id)
        selectedRowId.value = row.id
        await loadTradingData(true, false)
        window.$message.success('账户校验通过')
      }
      catch {
        window.$message.error(brokerAccountStore.error || '账户校验失败')
      }
    },
  })
}

function removeCurrent() {
  const row = currentSelectedRow.value
  if (!row) {
    window.$message.warning('请先选择账户')
    return
  }

  window.$dialog.warning({
    title: '删除确认',
    content: `确认删除账户 ${row.accountUid} 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await brokerAccountStore.removeAccount(row.id)
        if (selectedRowId.value === row.id)
          selectedRowId.value = brokerAccountStore.items[0]?.id || null
        await loadTradingData(false, false)
        window.$message.success('账户已删除')
      }
      catch {
        window.$message.error(brokerAccountStore.error || '删除账户失败')
      }
    },
  })
}

function onAccountRowClick(row: BrokerAccountItem) {
  selectedRowId.value = row.id
  if (row.status === 'active')
    brokerAccountStore.setSelectedAccount(row.id)
}

watch(
  () => brokerAccountStore.selectedAccountId,
  () => {
    void loadTradingData(false, false)
  },
)

onMounted(async () => {
  await loadAccounts()
  await loadTradingData(false, false)
})
</script>

<template>
  <n-space vertical :size="16">
    <n-alert type="info">
      本页用于绑定/校验 broker 交易账户并查看资金收益；paper 运行参数请在「个人配置」页面设置。
    </n-alert>

    <n-card title="交易账户中心" size="small">
      <n-space justify="space-between" align="center" :wrap="true">
        <n-space align="center" :wrap="true">
          <n-select
            v-model:value="selectedAccountId"
            clearable
            :options="activeAccountOptions"
            placeholder="选择活跃账户"
            style="width: 320px"
          />
          <n-switch v-model:value="forcingRefresh">
            <template #checked>
              强制上游刷新
            </template>
            <template #unchecked>
              缓存优先
            </template>
          </n-switch>
          <n-button :loading="tradingAccountStore.loadingOverview || tradingAccountStore.loadingDetails" @click="loadTradingData(forcingRefresh)">
            刷新交易数据
          </n-button>
        </n-space>
        <n-text depth="3">
          最近同步：{{ tradingAccountStore.lastLoadedAt ? formatDateTime(tradingAccountStore.lastLoadedAt) : '--' }}
        </n-text>
      </n-space>
    </n-card>

    <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <n-card title="券商账户管理" size="small">
          <n-space class="mb-3" :wrap="true">
            <n-button type="primary" @click="openCreate">
              新增账户
            </n-button>
            <n-button :disabled="!currentSelectedRow" @click="openEdit">
              编辑账户
            </n-button>
            <n-button :disabled="!currentSelectedRow" @click="verifyCurrent">
              校验账户
            </n-button>
            <n-button :disabled="!currentSelectedRow" type="error" @click="removeCurrent">
              删除账户
            </n-button>
            <n-button :loading="brokerAccountStore.loading" @click="loadAccounts">
              刷新列表
            </n-button>
          </n-space>
          <n-data-table
            size="small"
            :loading="brokerAccountStore.loading"
            :columns="accountColumns"
            :data="brokerAccountStore.items"
            :row-key="(row: BrokerAccountItem) => row.id"
            :row-props="(row: BrokerAccountItem) => ({ style: 'cursor:pointer', onClick: () => onAccountRowClick(row) })"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="12">
        <n-card title="资金与收益概览" size="small">
          <n-spin :show="tradingAccountStore.loadingOverview">
            <n-empty v-if="!currentTradingAccount" description="未配置可用的活跃账户，请先新增并校验账户" />
            <template v-else>
              <n-space vertical :size="10">
                <n-space align="center" :wrap="true">
                  <n-tag type="info">
                    账户：{{ currentTradingAccount.accountDisplayName || currentTradingAccount.accountUid }}
                  </n-tag>
                  <n-tag :type="currentTradingAccount.isVerified ? 'success' : 'warning'">
                    {{ currentTradingAccount.isVerified ? '已校验' : '未校验' }}
                  </n-tag>
                  <n-tag v-if="overviewMeta?.dataSource" type="default">
                    来源：{{ overviewMeta?.dataSource }}
                  </n-tag>
                </n-space>
                <n-descriptions bordered :column="2" size="small">
                  <n-descriptions-item label="总资产">
                    {{ formatAmount(overviewMetrics.totalAsset) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="可用现金">
                    {{ formatAmount(overviewMetrics.cash) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="持仓市值">
                    {{ formatAmount(overviewMetrics.marketValue) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="当日盈亏">
                    {{ formatAmount(overviewMetrics.pnlDaily) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="累计盈亏">
                    {{ formatAmount(overviewMetrics.pnlTotal) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="收益率">
                    {{ formatPct(overviewMetrics.returnPct, 2) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="快照时间" :span="2">
                    {{ overviewMeta?.snapshotAt ? formatDateTime(overviewMeta?.snapshotAt) : '--' }}
                  </n-descriptions-item>
                </n-descriptions>
                <n-alert v-if="tradingAccountStore.overviewError" type="error">
                  {{ tradingAccountStore.overviewError }}
                </n-alert>
              </n-space>
            </template>
          </n-spin>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="交易明细" size="small">
      <n-spin :show="tradingAccountStore.loadingDetails">
        <n-empty v-if="!currentTradingAccount" description="请选择可用账户查看持仓、委托和成交明细" />
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
          <n-alert v-if="tradingAccountStore.detailsError" class="mt-3" type="error">
            {{ tradingAccountStore.detailsError }}
          </n-alert>
        </template>
      </n-spin>
    </n-card>

    <n-modal v-model:show="createVisible" preset="card" title="新增券商账户" class="w-720px max-w-94vw">
      <n-space vertical>
        <n-form label-placement="top">
          <n-grid :cols="24" :x-gap="12">
            <n-grid-item :span="24" :l-span="8">
              <n-form-item label="券商代码">
                <n-input v-model:value="createForm.brokerCode" placeholder="例如：futu" />
              </n-form-item>
            </n-grid-item>
            <n-grid-item :span="24" :l-span="8">
              <n-form-item label="环境">
                <n-input v-model:value="createForm.environment" disabled />
              </n-form-item>
            </n-grid-item>
            <n-grid-item :span="24" :l-span="8">
              <n-form-item label="账户UID">
                <n-input v-model:value="createForm.accountUid" placeholder="券商账户 UID" />
              </n-form-item>
            </n-grid-item>
          </n-grid>
          <n-form-item label="显示名（可选）">
            <n-input v-model:value="createForm.accountDisplayName" placeholder="例如：我的富途模拟盘" />
          </n-form-item>
          <n-form-item label="凭据 JSON">
            <n-input
              v-model:value="createForm.credentialsText"
              type="textarea"
              :autosize="{ minRows: 8, maxRows: 14 }"
              placeholder="{&quot;api_key&quot;:&quot;xxx&quot;,&quot;api_secret&quot;:&quot;yyy&quot;}"
            />
          </n-form-item>
        </n-form>
        <n-space justify="end">
          <n-button @click="createVisible = false">
            取消
          </n-button>
          <n-button type="primary" :loading="submitting" @click="submitCreate">
            创建
          </n-button>
        </n-space>
      </n-space>
    </n-modal>

    <n-modal v-model:show="editVisible" preset="card" title="编辑券商账户" class="w-720px max-w-94vw">
      <n-space vertical>
        <n-form label-placement="top">
          <n-form-item label="显示名">
            <n-input v-model:value="editForm.accountDisplayName" placeholder="可为空" />
          </n-form-item>
          <n-form-item label="状态">
            <n-select
              v-model:value="editForm.status"
              :options="[
                { label: 'active', value: 'active' },
                { label: 'disabled', value: 'disabled' },
              ]"
            />
          </n-form-item>
          <n-form-item label="更新凭据">
            <n-switch v-model:value="editForm.updateCredentials" />
          </n-form-item>
          <n-form-item v-if="editForm.updateCredentials" label="新凭据 JSON">
            <n-input
              v-model:value="editForm.credentialsText"
              type="textarea"
              :autosize="{ minRows: 8, maxRows: 14 }"
              placeholder="{&quot;api_key&quot;:&quot;xxx&quot;,&quot;api_secret&quot;:&quot;yyy&quot;}"
            />
          </n-form-item>
        </n-form>
        <n-space justify="end">
          <n-button @click="editVisible = false">
            取消
          </n-button>
          <n-button type="primary" :loading="submitting" @click="submitEdit">
            保存
          </n-button>
        </n-space>
      </n-space>
    </n-modal>
  </n-space>
</template>
