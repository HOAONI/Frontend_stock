import type { DataTableColumns } from 'naive-ui'
import type { CSSProperties } from 'vue'

export type TradingUiType = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'

export interface TradingBindFormModel {
  accountUid: string
  accountDisplayName: string
  initialCapital: number
  commissionRate: number
  slippageBps: number
}

export interface TradingAddFundsFormModel {
  amount: number
  note: string
}

export interface TradingAccountHeroModel {
  title: string
  accountUid: string
  description: string
  statusLabel: string
  statusType: TradingUiType
  providerLabel: string
  environmentLabel: string
  dataSourceLabel: string
  lastVerifiedAt: string
  lastSyncedAt: string
}

export interface TradingAccountMetaItem {
  key: string
  label: string
  value: string
  type?: TradingUiType
}

export interface TradingAccountKpiModel {
  key: string
  label: string
  value: number | null
  precision?: number
  suffix?: string
  valueStyle?: CSSProperties
  caption: string
}

export interface TradingAccountCountItem {
  key: string
  label: string
  value: number
}

export interface TradingAccountRatioItem {
  key: string
  label: string
  percentage: number
  status: 'success' | 'info'
  valueLabel: string
}

export interface TradingAccountActivityItem {
  id: string
  stockCode: string
  direction: string
  quantity: string
  status: string
  time: string
}

export interface TradingAccountDetailTabModel {
  name: string
  label: string
  count: number
  emptyDescription: string
  columns: DataTableColumns<Record<string, unknown>>
  data: Array<Record<string, unknown>>
}
