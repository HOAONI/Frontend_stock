import { getReservedTaskStages } from '@/api/reserved-analysis'
import type { AnalysisReport } from '@/types/analysis'
import type { AgentStageResult } from '@/types/agent-stages'
import { parseAgentStagesFromRawResult } from '@/utils/agent-stages'
import { getDataMode, getHttpStatus, isMissingApiStatus } from './data-source'
import type { ServicePayload } from './data-source'

function stageTitle(code: 'data' | 'signal' | 'risk' | 'execution') {
  if (code === 'data')
    return '数据获取 Agent'
  if (code === 'signal')
    return '信号策略 Agent'
  if (code === 'risk')
    return '风险控制 Agent'
  return '执行 Agent'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  return value as Record<string, unknown>
}

function parseRawFromReport(report: AnalysisReport | null): unknown {
  const details = asRecord(report?.details)
  return details?.rawResult ?? null
}

export async function resolveAgentStages(taskId: string | null, report: AnalysisReport | null): Promise<ServicePayload<AgentStageResult>> {
  const mode = getDataMode()
  const missingApis: string[] = []
  const warnings: string[] = []

  if (mode !== 'mock' && taskId) {
    try {
      const data = await getReservedTaskStages(taskId)
      return {
        data: {
          stages: data.stages.map(item => ({
            ...item,
            title: stageTitle(item.code),
            summary: item.summary || '阶段执行完成',
          })),
          warnings: [],
        },
        dataSource: 'api',
        missingApis,
        warnings,
      }
    }
    catch (error: unknown) {
      const status = getHttpStatus(error)
      if (isMissingApiStatus(status)) {
        missingApis.push('/api/v1/analysis/tasks/:task_id/stages')
        warnings.push('阶段接口未开放，已使用报告原始数据解析')
      }
      else {
        warnings.push('阶段接口调用失败，已使用报告原始数据解析')
      }
    }
  }

  const parsed = parseAgentStagesFromRawResult(parseRawFromReport(report))
  return {
    data: parsed,
    dataSource: mode === 'mock' ? 'mock' : 'derived',
    missingApis,
    warnings: [...warnings, ...parsed.warnings],
  }
}
