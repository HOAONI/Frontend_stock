import {
  createAnalysisSchedule,
  deleteAnalysisSchedule,
  getAnalysisScheduleDetail,
  listAnalysisSchedules,
  updateAnalysisSchedule,
} from '@/api/analysis-scheduler'
import type {
  AnalysisScheduleDetail,
  AnalysisScheduleFormModel,
  AnalysisScheduleItem,
  AnalysisScheduleLastTaskStatus,
} from '@/types/analysis-scheduler'
import { validateStockCode } from '@/utils/stock'

function createDefaultForm(): AnalysisScheduleFormModel {
  return {
    stockCode: '',
    intervalMinutes: 5,
    executionMode: 'paper',
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

export function useSchedulerCenter() {
  const schedules = ref<AnalysisScheduleItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const rowActionId = ref<string | null>(null)
  const detailLoading = ref(false)
  const detailVisible = ref(false)
  const detail = ref<AnalysisScheduleDetail | null>(null)
  const editingScheduleId = ref<string | null>(null)
  const form = reactive<AnalysisScheduleFormModel>(createDefaultForm())

  const executionModeOptions = [
    { label: 'Auto（自动执行）', value: 'auto' },
    { label: 'Paper（仅分析）', value: 'paper' },
  ] as const

  const editingSchedule = computed(() => schedules.value.find(item => item.scheduleId === editingScheduleId.value) || null)
  const enabledCount = computed(() => schedules.value.filter(item => item.enabled).length)
  const pausedCount = computed(() => schedules.value.filter(item => !item.enabled).length)
  const processingCount = computed(() => schedules.value.filter(item => item.lastTaskStatus === 'processing').length)
  const dueSoonCount = computed(() => {
    const now = Date.now()
    const cutoff = now + 5 * 60 * 1000
    return schedules.value.filter(item => item.enabled && new Date(item.nextRunAt).getTime() <= cutoff).length
  })

  function resetForm() {
    Object.assign(form, createDefaultForm())
  }

  function startCreate() {
    editingScheduleId.value = null
    resetForm()
  }

  function startEdit(schedule: AnalysisScheduleItem) {
    editingScheduleId.value = schedule.scheduleId
    form.stockCode = schedule.stockCode
    form.intervalMinutes = schedule.intervalMinutes
    form.executionMode = schedule.executionMode
  }

  async function refreshSchedules(silent = false) {
    if (loading.value)
      return

    loading.value = true
    try {
      const data = await listAnalysisSchedules()
      schedules.value = data.items

      if (editingScheduleId.value && !data.items.some(item => item.scheduleId === editingScheduleId.value))
        startCreate()
    }
    catch (error) {
      if (!silent)
        window.$message.error(getErrorMessage(error, '加载定时任务失败'))
    }
    finally {
      loading.value = false
    }
  }

  async function refreshDetail(scheduleId: string, options?: { openDrawer?: boolean }) {
    detailLoading.value = true
    if (options?.openDrawer)
      detailVisible.value = true

    try {
      detail.value = await getAnalysisScheduleDetail(scheduleId)
    }
    catch (error) {
      window.$message.error(getErrorMessage(error, '加载定时任务详情失败'))
      if (options?.openDrawer)
        detailVisible.value = false
    }
    finally {
      detailLoading.value = false
    }
  }

  async function submitForm() {
    if (saving.value)
      return

    const { valid, normalized, message } = validateStockCode(form.stockCode)
    if (!valid) {
      window.$message.error(message || '股票代码格式不正确')
      return
    }

    if (!form.intervalMinutes || !Number.isInteger(form.intervalMinutes) || form.intervalMinutes < 1 || form.intervalMinutes > 10080) {
      window.$message.error('周期分钟数必须是 1 到 10080 的整数')
      return
    }

    saving.value = true
    try {
      if (editingScheduleId.value) {
        const updated = await updateAnalysisSchedule(editingScheduleId.value, {
          stockCode: normalized,
          intervalMinutes: form.intervalMinutes,
          executionMode: form.executionMode,
        })
        window.$message.success(`已更新 ${updated.stockCode} 的定时任务`)
      }
      else {
        const created = await createAnalysisSchedule({
          stockCode: normalized,
          intervalMinutes: form.intervalMinutes,
          executionMode: form.executionMode,
        })
        window.$message.success(`已创建 ${created.stockCode} 的定时任务，系统会立即触发一次分析`)
      }

      await refreshSchedules(true)
      if (detail.value?.schedule.scheduleId) {
        await refreshDetail(detail.value.schedule.scheduleId)
      }
      startCreate()
    }
    catch (error) {
      window.$message.error(getErrorMessage(error, editingScheduleId.value ? '更新定时任务失败' : '创建定时任务失败'))
    }
    finally {
      saving.value = false
    }
  }

  async function handleToggle(schedule: AnalysisScheduleItem, enabled: boolean) {
    rowActionId.value = schedule.scheduleId
    try {
      await updateAnalysisSchedule(schedule.scheduleId, { enabled })
      window.$message.success(enabled ? '定时任务已启用，系统会立即重新调度' : '定时任务已暂停')
      await refreshSchedules(true)
      if (detail.value?.schedule.scheduleId === schedule.scheduleId)
        await refreshDetail(schedule.scheduleId)
    }
    catch (error) {
      window.$message.error(getErrorMessage(error, enabled ? '启用定时任务失败' : '暂停定时任务失败'))
    }
    finally {
      rowActionId.value = null
    }
  }

  function handleDelete(schedule: AnalysisScheduleItem) {
    window.$dialog.warning({
      title: '删除定时任务',
      content: `确定删除 ${schedule.stockCode} 的 ${schedule.intervalMinutes} 分钟定时任务吗？`,
      positiveText: '删除',
      negativeText: '取消',
      onPositiveClick: async () => {
        rowActionId.value = schedule.scheduleId
        try {
          await deleteAnalysisSchedule(schedule.scheduleId)
          window.$message.success('定时任务已删除')
          if (editingScheduleId.value === schedule.scheduleId)
            startCreate()
          if (detail.value?.schedule.scheduleId === schedule.scheduleId) {
            detailVisible.value = false
            detail.value = null
          }
          await refreshSchedules(true)
        }
        catch (error) {
          window.$message.error(getErrorMessage(error, '删除定时任务失败'))
        }
        finally {
          rowActionId.value = null
        }
      },
    })
  }

  function statusTagType(status: AnalysisScheduleLastTaskStatus): 'default' | 'info' | 'success' | 'warning' | 'error' {
    if (status === 'processing')
      return 'info'
    if (status === 'completed')
      return 'success'
    if (status === 'failed')
      return 'error'
    if (status === 'pending')
      return 'warning'
    if (status === 'skipped')
      return 'warning'
    return 'default'
  }

  function statusLabel(status: AnalysisScheduleLastTaskStatus): string {
    if (status === 'pending')
      return '排队中'
    if (status === 'processing')
      return '执行中'
    if (status === 'completed')
      return '已完成'
    if (status === 'failed')
      return '失败'
    if (status === 'cancelled')
      return '已取消'
    if (status === 'skipped')
      return '已跳过'
    return '未触发'
  }

  onMounted(() => {
    void refreshSchedules()
  })

  return {
    detail,
    detailLoading,
    detailVisible,
    dueSoonCount,
    editingSchedule,
    enabledCount,
    executionModeOptions,
    form,
    handleDelete,
    handleToggle,
    loading,
    pausedCount,
    processingCount,
    refreshDetail,
    refreshSchedules,
    rowActionId,
    saving,
    schedules,
    startCreate,
    startEdit,
    statusLabel,
    statusTagType,
    submitForm,
  }
}
