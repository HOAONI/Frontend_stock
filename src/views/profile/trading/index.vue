<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import { addTradingFunds } from '@/api/trading-account'
import { DASHBOARD_LAYOUT, SPACING } from '@/constants/design-tokens'
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'
import TradingAccountActionsCard from './components/TradingAccountActionsCard.vue'
import TradingAccountActivityCard from './components/TradingAccountActivityCard.vue'
import TradingAccountDetailTabs from './components/TradingAccountDetailTabs.vue'
import TradingAccountFundingCard from './components/TradingAccountFundingCard.vue'
import TradingAccountHeroCard from './components/TradingAccountHeroCard.vue'
import TradingAccountKpiCard from './components/TradingAccountKpiCard.vue'
import TradingAccountMetaCard from './components/TradingAccountMetaCard.vue'
import TradingAccountSetupCard from './components/TradingAccountSetupCard.vue'
import TradingAccountSummaryCard from './components/TradingAccountSummaryCard.vue'
import { useTradingAccountCenterViewModel } from './composables/useTradingAccountCenterViewModel'
import type { TradingAddFundsFormModel, TradingBindFormModel } from './types'

const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const forcingRefresh = shallowRef(false)
const binding = shallowRef(false)
const funding = shallowRef(false)
const failedWithHistoricalAccountUid = shallowRef(false)

const bindForm = reactive<TradingBindFormModel>({
  accountUid: '',
  accountDisplayName: '',
  initialCapital: 100000,
  commissionRate: 0.0003,
  slippageBps: 2,
})

const addFundsForm = reactive<TradingAddFundsFormModel>({
  amount: 10000,
  note: '',
})

const setupSection = useTemplateRef<HTMLElement>('setupSection')
const fundingSection = useTemplateRef<HTMLElement>('fundingSection')

const bindInlineError = computed(() => brokerAccountStore.bindError || brokerAccountStore.error)

const {
  simulationStatus,
  canLoadTradingData,
  accountStateLabel,
  accountStateType,
  stateDescription,
  heroCard,
  metaItems,
  kpiCards,
  summaryCounts,
  summaryRatios,
  fundingReference,
  recentOrders,
  recentTrades,
  activityColumns,
  detailTabs,
} = useTradingAccountCenterViewModel()

const hasHistoricalAccountUid = computed(() => {
  const statusAccountUid = simulationStatus.value?.accountUid?.trim()
  return Boolean(statusAccountUid && bindForm.accountUid.trim() && bindForm.accountUid.trim() === statusAccountUid)
})

function toNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    return null
  return parsed
}

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

function scrollToSection(target?: HTMLElement | null) {
  target?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function syncBindFormFromStatus() {
  const status = simulationStatus.value
  if (!bindForm.accountUid.trim() && status?.accountUid)
    bindForm.accountUid = status.accountUid
  if (!bindForm.accountDisplayName.trim() && status?.accountDisplayName)
    bindForm.accountDisplayName = status.accountDisplayName
}

function clearAccountUidInput() {
  bindForm.accountUid = ''
}

function extractActionError(error: unknown, fallback: string): string {
  const payload = error as { response?: { data?: { message?: string } } }
  const message = String(payload?.response?.data?.message ?? '').trim()
  return message || fallback
}

async function loadSimulationStatus(silent = false): Promise<boolean> {
  try {
    await brokerAccountStore.loadSimulationStatus()
    syncBindFormFromStatus()
    if (!canLoadTradingData.value)
      tradingAccountStore.clearData()
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

async function refreshStatusNow() {
  const ok = await loadSimulationStatus()
  if (!ok)
    return
  if (canLoadTradingData.value && !tradingAccountStore.hasData)
    await refreshTradingData(false, true)
}

async function refreshSnapshotNow() {
  await refreshTradingData(forcingRefresh.value)
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

watch(() => addFundsForm.amount, (value) => {
  const normalized = toNumber(value)
  if (normalized == null || normalized <= 0)
    return
  addFundsForm.amount = normalized
})
</script>

<template>
  <n-space vertical :size="SPACING.lg">
    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="12">
        <TradingAccountHeroCard
          :hero="heroCard"
          :error="brokerAccountStore.simulationStatusLoadFailed ? brokerAccountStore.simulationStatusError : ''"
        />
      </n-grid-item>

      <n-grid-item :span="24" :m-span="12" :l-span="6">
        <TradingAccountMetaCard :items="metaItems" />
      </n-grid-item>

      <n-grid-item :span="24" :m-span="12" :l-span="6">
        <TradingAccountActionsCard
          v-model:forcing-refresh="forcingRefresh"
          :status-label="accountStateLabel"
          :status-type="accountStateType"
          :status-description="stateDescription"
          :status-loading="brokerAccountStore.loading"
          :data-loading="tradingAccountStore.loadingOverview || tradingAccountStore.loadingDetails"
          :can-load-trading-data="canLoadTradingData"
          :data-error="tradingAccountStore.overviewError"
          @refresh-status="refreshStatusNow"
          @refresh-data="refreshSnapshotNow"
          @scroll-setup="scrollToSection(setupSection)"
          @scroll-funding="scrollToSection(fundingSection)"
        />
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.innerGap" :y-gap="DASHBOARD_LAYOUT.innerGap" responsive="screen">
      <n-grid-item
        v-for="item in kpiCards"
        :key="item.key"
        :span="12"
        :l-span="6"
      >
        <TradingAccountKpiCard :item="item" />
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="14">
        <div ref="setupSection">
          <TradingAccountSetupCard
            v-model:form="bindForm"
            :status-label="accountStateLabel"
            :status-type="accountStateType"
            :inline-error="bindInlineError"
            :historical-uid-warning="failedWithHistoricalAccountUid"
            :loading="binding || brokerAccountStore.submitting"
            @clear-account-uid="clearAccountUidInput"
            @submit="bindSimulationAccountNow"
          />
        </div>
      </n-grid-item>

      <n-grid-item :span="24" :l-span="10">
        <div ref="fundingSection">
          <TradingAccountFundingCard
            v-model:form="addFundsForm"
            :enabled="canLoadTradingData"
            :cash-text="fundingReference.cashText"
            :total-asset-text="fundingReference.totalAssetText"
            :loading="funding"
            @submit="addFundsNow"
          />
        </div>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="DASHBOARD_LAYOUT.cols" :x-gap="DASHBOARD_LAYOUT.outerGap" :y-gap="DASHBOARD_LAYOUT.outerGap" responsive="screen">
      <n-grid-item :span="24" :l-span="8">
        <TradingAccountSummaryCard
          :ready="canLoadTradingData"
          :loading="tradingAccountStore.loadingOverview || tradingAccountStore.loadingDetails"
          :count-items="summaryCounts"
          :ratio-items="summaryRatios"
        />
      </n-grid-item>

      <n-grid-item :span="24" :l-span="8">
        <TradingAccountActivityCard
          title="最近委托"
          count-type="info"
          :items="recentOrders"
          :columns="activityColumns"
          empty-description="暂无委托数据"
        />
      </n-grid-item>

      <n-grid-item :span="24" :l-span="8">
        <TradingAccountActivityCard
          title="最近成交"
          count-type="success"
          :items="recentTrades"
          :columns="activityColumns"
          empty-description="暂无成交数据"
        />
      </n-grid-item>
    </n-grid>

    <TradingAccountDetailTabs
      :ready="canLoadTradingData"
      :loading="tradingAccountStore.loadingDetails"
      :error="tradingAccountStore.detailsError"
      :tabs="detailTabs"
    />
  </n-space>
</template>
