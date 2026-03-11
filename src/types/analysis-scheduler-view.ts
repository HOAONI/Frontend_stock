import type {
  SchedulerScope,
  SchedulerTaskDetail,
  SchedulerTaskItem,
} from '@/types/analysis-scheduler'

export type SchedulerTone = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'

export interface SchedulerOption<T = string> {
  label: string
  value: T
}

export interface SchedulerFilterForm {
  status: string | null
  stockCode: string
  username: string
  executionMode: string | null
  staleOnly: boolean
  dateRange: [number, number] | null
}

export interface SchedulerHighlightItem {
  key: string
  label: string
  value: string
}

export interface SchedulerMetricItem {
  key: string
  label: string
  value: string | number
  hint: string
  type: SchedulerTone
}

export interface SchedulerHealthItem {
  key: string
  label: string
  ok: boolean
  hint: string
}

export interface SchedulerFieldItem {
  key: string
  label: string
  value: string
}

export interface SchedulerTagItem {
  key: string
  label: string
  type: SchedulerTone
}

export interface SchedulerPolicyItem {
  key: string
  envKey: string
  title: string
  description: string
  value: string
}

export interface SchedulerPayloadCard {
  key: string
  title: string
  value: string
}

export interface SchedulerTimelineItem {
  key: string
  title: string
  content: string
  time: string
  type: Exclude<SchedulerTone, 'primary'>
}

export interface SchedulerSelectedTaskView {
  summary: string
  headerTag: SchedulerTagItem | null
  tags: SchedulerTagItem[]
  fields: SchedulerFieldItem[]
  progress: number | null
}

export interface SchedulerTaskCardView {
  task: SchedulerTaskItem
  title: string
  subtitle: string
  statusTag: SchedulerTagItem
  tags: SchedulerTagItem[]
  fields: SchedulerFieldItem[]
  timeline: SchedulerFieldItem[]
  message: string
  messageType: Exclude<SchedulerTone, 'default' | 'primary'>
  progress: number | null
}

export interface SchedulerDetailView {
  detail: SchedulerTaskDetail
  title: string
  summary: string
  headerTag: SchedulerTagItem
  tags: SchedulerTagItem[]
  fields: SchedulerFieldItem[]
  progress: number | null
  chainItems: SchedulerTimelineItem[]
  payloadCards: SchedulerPayloadCard[]
}

export interface SchedulerActionState {
  canRetry: boolean
  canRerun: boolean
  canCancel: boolean
  canAdjustPriority: boolean
}

export interface SchedulerHeroView {
  isAdmin: boolean
  scope: SchedulerScope
  scopeOptions: SchedulerOption<SchedulerScope>[]
  scopeLabel: string
  summary: string
  updatedAt: string
  loading: boolean
  highlights: SchedulerHighlightItem[]
}
