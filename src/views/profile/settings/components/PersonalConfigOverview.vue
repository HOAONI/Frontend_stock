<script setup lang="ts">
import type { PersonalConfigStatusTag } from '../types'

const props = defineProps<{
  displayName: string
  username: string
  userIdText: string
  roleText: string
  scopeText: string
  lastSavedAt: string
  statusTags: PersonalConfigStatusTag[]
  hasPendingChanges: boolean
  saveErrors: string[]
  saving: boolean
}>()

const emit = defineEmits<{
  save: []
  reset: []
  openTrading: []
}>()

const avatarText = computed(() => props.displayName.slice(0, 2))
</script>

<template>
  <n-card :segmented="{ content: 'soft' }">
    <n-space vertical :size="16">
      <n-flex justify="space-between" align="center" wrap :size="[20, 16]">
        <n-space align="center" :size="16">
          <n-avatar round :size="56">
            {{ avatarText }}
          </n-avatar>

          <n-space vertical :size="6">
            <n-space align="center" :size="8">
              <n-text strong>
                {{ displayName }}
              </n-text>
              <n-tag type="success" size="small">
                在线
              </n-tag>
            </n-space>

            <n-space :size="12" wrap>
              <n-text depth="3">
                用户名 {{ username }}
              </n-text>
              <n-text depth="3">
                账号 ID {{ userIdText }}
              </n-text>
              <n-text depth="3">
                角色 {{ roleText }}
              </n-text>
            </n-space>

            <n-text depth="3">
              作用范围：{{ scopeText }}
            </n-text>

            <n-space wrap :size="[8, 8]">
              <n-tag
                v-for="tag in statusTags"
                :key="tag.label"
                size="small"
                round
                :type="tag.type || 'default'"
              >
                {{ tag.label }}
              </n-tag>
            </n-space>
          </n-space>
        </n-space>

        <n-space vertical :size="12">
          <n-flex justify="end" wrap :size="[12, 12]">
            <n-button quaternary @click="emit('openTrading')">
              交易账户中心
            </n-button>
            <n-button :disabled="!hasPendingChanges" @click="emit('reset')">
              重置服务端配置
            </n-button>
            <n-button
              type="primary"
              :loading="saving"
              :disabled="!hasPendingChanges"
              @click="emit('save')"
            >
              保存更改
            </n-button>
          </n-flex>

          <n-space justify="end" :size="8" wrap>
            <n-tag :type="hasPendingChanges ? 'warning' : 'success'" size="small" round>
              {{ hasPendingChanges ? '存在未保存改动' : '服务端已同步' }}
            </n-tag>
            <n-text depth="3">
              最近同步：{{ lastSavedAt }}
            </n-text>
          </n-space>
        </n-space>
      </n-flex>

      <n-alert v-if="saveErrors.length" type="error">
        <template #header>
          保存前需要处理以下问题
        </template>
        <n-space vertical :size="6">
          <n-text v-for="issue in saveErrors" :key="issue">
            {{ issue }}
          </n-text>
        </n-space>
      </n-alert>

      <n-alert v-else-if="hasPendingChanges" type="warning">
        你有尚未保存的服务端配置变更。界面偏好已即时生效，基础资料与策略参数需要点击“保存更改”后才会写回账户配置；AI 绑定请在下方卡片内直接操作。
      </n-alert>
    </n-space>
  </n-card>
</template>
