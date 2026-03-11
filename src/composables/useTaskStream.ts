import type { TaskInfo } from '@/types/analysis'
import { getTaskStreamUrl } from '@/api/analysis'
import { toCamelCase } from '@/api/case'

interface UseTaskStreamOptions {
  enabled?: Ref<boolean>
  onConnected?: () => void
  onTaskCreated?: (task: TaskInfo) => void
  onTaskStarted?: (task: TaskInfo) => void
  onTaskCompleted?: (task: TaskInfo) => void
  onTaskFailed?: (task: TaskInfo) => void
  onTaskCancelled?: (task: TaskInfo) => void
  onError?: (error: Event) => void
}

export function useTaskStream(options: UseTaskStreamOptions = {}) {
  const isConnected = ref(false)
  const reconnectTimer = ref<number | null>(null)
  let source: EventSource | null = null

  function parseTask(data: string): TaskInfo | null {
    try {
      return toCamelCase<TaskInfo>(JSON.parse(data))
    }
    catch {
      return null
    }
  }

  function clearReconnect() {
    if (reconnectTimer.value != null) {
      window.clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
  }

  function disconnect() {
    clearReconnect()
    if (source) {
      source.close()
      source = null
    }
    isConnected.value = false
  }

  function connect() {
    disconnect()
    source = new EventSource(getTaskStreamUrl(), { withCredentials: true })

    source.addEventListener('connected', () => {
      isConnected.value = true
      options.onConnected?.()
    })

    source.addEventListener('task_created', (event) => {
      const task = parseTask((event as MessageEvent).data)
      if (task)
        options.onTaskCreated?.(task)
    })

    source.addEventListener('task_started', (event) => {
      const task = parseTask((event as MessageEvent).data)
      if (task)
        options.onTaskStarted?.(task)
    })

    source.addEventListener('task_completed', (event) => {
      const task = parseTask((event as MessageEvent).data)
      if (task)
        options.onTaskCompleted?.(task)
    })

    source.addEventListener('task_failed', (event) => {
      const task = parseTask((event as MessageEvent).data)
      if (task)
        options.onTaskFailed?.(task)
    })

    source.addEventListener('task_cancelled', (event) => {
      const task = parseTask((event as MessageEvent).data)
      if (task)
        options.onTaskCancelled?.(task)
    })

    source.onerror = (error) => {
      isConnected.value = false
      options.onError?.(error)
      disconnect()
      reconnectTimer.value = window.setTimeout(connect, 3000)
    }
  }

  onMounted(() => {
    if (!options.enabled || options.enabled.value)
      connect()
  })

  onUnmounted(disconnect)

  if (options.enabled) {
    watch(options.enabled, (enabled) => {
      if (enabled)
        connect()
      else
        disconnect()
    })
  }

  return {
    isConnected,
    connect,
    disconnect,
  }
}
