<script setup lang="ts">
import AgentStagePanel from '@/components/analysis/AgentStagePanel.vue'
import type { AgentStageItem } from '@/types/agent-stages'
import type { SchedulerDetailView } from '@/types/analysis-scheduler-view'

const props = defineProps<{
  loading: boolean
  detail: SchedulerDetailView | null
  stages: AgentStageItem[]
  stageWarning: string
}>()

const show = defineModel<boolean>('show', { required: true })

const activeTab = ref<'summary' | 'chain' | 'stages' | 'payload'>('summary')

watch(() => [show.value, props.detail?.detail.task.taskId], ([visible]) => {
  if (visible)
    activeTab.value = 'summary'
}, { immediate: true })
</script>

<template>
  <n-drawer v-model:show="show" :width="960">
    <n-drawer-content :title="props.detail?.title || '调度任务详情'" closable>
      <n-spin :show="props.loading">
        <n-empty v-if="!props.detail && !props.loading" description="暂无任务详情" />

        <n-tabs v-else-if="props.detail" v-model:value="activeTab" type="line" animated>
          <n-tab-pane name="summary" tab="摘要">
            <n-space vertical :size="16">
              <n-alert type="info" :show-icon="false">
                {{ props.detail.summary }}
              </n-alert>

              <n-space :size="8" :wrap="true">
                <n-tag round size="small" :type="props.detail.headerTag.type">
                  {{ props.detail.headerTag.label }}
                </n-tag>
                <n-tag v-for="tag in props.detail.tags.slice(1)" :key="tag.key" round size="small" :type="tag.type">
                  {{ tag.label }}
                </n-tag>
              </n-space>

              <n-progress
                v-if="props.detail.progress != null"
                type="line"
                :percentage="props.detail.progress"
                indicator-placement="inside"
                processing
              />

              <n-descriptions bordered label-placement="top" size="small" :column="2">
                <n-descriptions-item v-for="item in props.detail.fields" :key="item.key" :label="item.label">
                  <span class="scheduler-break-all">{{ item.value }}</span>
                </n-descriptions-item>
              </n-descriptions>
            </n-space>
          </n-tab-pane>

          <n-tab-pane name="chain" tab="任务链路">
            <n-timeline>
              <n-timeline-item
                v-for="item in props.detail.chainItems"
                :key="item.key"
                :type="item.type"
                :title="item.title"
                :content="item.content"
                :time="item.time"
              />
            </n-timeline>
          </n-tab-pane>

          <n-tab-pane name="stages" tab="阶段详情">
            <n-space vertical :size="16">
              <n-alert v-if="props.stageWarning" type="warning" :show-icon="false">
                {{ props.stageWarning }}
              </n-alert>
              <AgentStagePanel :stages="props.stages" />
            </n-space>
          </n-tab-pane>

          <n-tab-pane name="payload" tab="载荷快照">
            <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
              <n-grid-item v-for="item in props.detail.payloadCards" :key="item.key" :span="24" :l-span="12">
                <n-card embedded size="small" :bordered="false">
                  <n-space vertical :size="10">
                    <n-text strong>
                      {{ item.title }}
                    </n-text>
                    <pre class="scheduler-json-block">{{ item.value }}</pre>
                  </n-space>
                </n-card>
              </n-grid-item>
            </n-grid>
          </n-tab-pane>
        </n-tabs>
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<style scoped>
.scheduler-break-all {
  word-break: break-all;
}

.scheduler-json-block {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}
</style>
