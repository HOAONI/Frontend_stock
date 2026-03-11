import type { TaskInfo, TaskSeenAtMap, TaskTerminalStatus } from '@/types/analysis'

const RECENT_TASK_LIMIT = 20
const EVENT_PROTECT_WINDOW_MS = 30_000

function isRunningStatus(status: TaskInfo['status']): boolean {
  return status === 'pending' || status === 'processing'
}

function isTerminalStatus(status: TaskInfo['status']): status is TaskTerminalStatus {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function resolveRunningSortTime(task: TaskInfo): number {
  return new Date(task.startedAt || task.createdAt).getTime() || 0
}

function resolveRecentSortTime(task: TaskInfo): number {
  return new Date(task.completedAt || task.createdAt).getTime() || 0
}

function sortRunningTasks(tasks: TaskInfo[]): TaskInfo[] {
  return [...tasks].sort((a, b) => resolveRunningSortTime(b) - resolveRunningSortTime(a))
}

function sortRecentTasks(tasks: TaskInfo[]): TaskInfo[] {
  return [...tasks].sort((a, b) => resolveRecentSortTime(b) - resolveRecentSortTime(a))
}

function trimRecentMap(map: Record<string, TaskInfo>): Record<string, TaskInfo> {
  const trimmed = sortRecentTasks(Object.values(map)).slice(0, RECENT_TASK_LIMIT)
  const result: Record<string, TaskInfo> = {}
  trimmed.forEach((task) => {
    result[task.taskId] = task
  })
  return result
}

export function useTaskQueueState() {
  const runningTaskMap = ref<Record<string, TaskInfo>>({})
  const recentTaskMap = ref<Record<string, TaskInfo>>({})
  const taskSeenAt = ref<TaskSeenAtMap>({})
  const recentFilter = ref<'all' | TaskTerminalStatus>('all')
  const lastSyncedAt = ref<string | null>(null)

  const runningTasks = computed(() => sortRunningTasks(Object.values(runningTaskMap.value)))
  const recentTasks = computed(() => sortRecentTasks(Object.values(recentTaskMap.value)))

  const filteredRecentTasks = computed(() => {
    if (recentFilter.value === 'all')
      return recentTasks.value
    return recentTasks.value.filter(task => task.status === recentFilter.value)
  })

  function handleEventTask(task: TaskInfo, now = Date.now()) {
    taskSeenAt.value = {
      ...taskSeenAt.value,
      [task.taskId]: now,
    }

    if (isRunningStatus(task.status)) {
      runningTaskMap.value = {
        ...runningTaskMap.value,
        [task.taskId]: task,
      }
      if (recentTaskMap.value[task.taskId]) {
        const nextRecent = { ...recentTaskMap.value }
        delete nextRecent[task.taskId]
        recentTaskMap.value = nextRecent
      }
      return
    }

    if (!isTerminalStatus(task.status))
      return

    const nextRunning = { ...runningTaskMap.value }
    delete nextRunning[task.taskId]
    runningTaskMap.value = nextRunning

    const nextRecent = {
      ...recentTaskMap.value,
      [task.taskId]: task,
    }
    recentTaskMap.value = trimRecentMap(nextRecent)
  }

  function reconcileFromSnapshot(tasks: TaskInfo[], now = Date.now()) {
    const snapshotRunning: Record<string, TaskInfo> = {}
    const snapshotTerminal: TaskInfo[] = []
    const nextSeenAt: TaskSeenAtMap = { ...taskSeenAt.value }

    tasks.forEach((task) => {
      nextSeenAt[task.taskId] = now
      if (isRunningStatus(task.status)) {
        snapshotRunning[task.taskId] = task
        return
      }
      if (isTerminalStatus(task.status))
        snapshotTerminal.push(task)
    })

    const snapshotRunningIds = new Set(Object.keys(snapshotRunning))
    const nextRunning: Record<string, TaskInfo> = { ...snapshotRunning }
    Object.values(runningTaskMap.value).forEach((task) => {
      if (snapshotRunningIds.has(task.taskId))
        return

      const seenAt = nextSeenAt[task.taskId] || 0
      if (now - seenAt <= EVENT_PROTECT_WINDOW_MS)
        nextRunning[task.taskId] = task
    })

    const nextRecent = { ...recentTaskMap.value }
    snapshotTerminal.forEach((task) => {
      delete nextRunning[task.taskId]
      nextRecent[task.taskId] = task
    })

    runningTaskMap.value = nextRunning
    recentTaskMap.value = trimRecentMap(nextRecent)
    taskSeenAt.value = nextSeenAt
    lastSyncedAt.value = new Date(now).toISOString()
  }

  function getTaskById(taskId: string): TaskInfo | null {
    return runningTaskMap.value[taskId] || recentTaskMap.value[taskId] || null
  }

  return {
    runningTasks,
    recentTasks,
    filteredRecentTasks,
    recentFilter,
    lastSyncedAt,
    handleEventTask,
    reconcileFromSnapshot,
    getTaskById,
  }
}
