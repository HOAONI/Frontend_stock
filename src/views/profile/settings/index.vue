<script setup lang="ts">
import type { PersonalAiProvider } from '@/types/user-settings'
import { useSessionStore, useUserSettingsStore } from '@/store'
import { formatDateTime } from '@/utils/stock'

const router = useRouter()
const sessionStore = useSessionStore()
const userSettingsStore = useUserSettingsStore()

const saveErrors = ref<string[]>([])
const apiTokenInput = ref('')
const personalProviderInput = ref<PersonalAiProvider | null>(null)
const originalPersonalProvider = ref<PersonalAiProvider | ''>('')

const MASKED_TOKEN = '******'

const username = computed(() => sessionStore.currentUser?.username || '--')
const roleText = computed(() => sessionStore.isAdmin ? '管理员' : '普通用户')
const lastSavedAt = computed(() => {
  if (!userSettingsStore.settings.updatedAt)
    return '--'
  return formatDateTime(userSettingsStore.settings.updatedAt)
})
const CONTROL_WIDTH_STYLE = { width: '100%', maxWidth: '320px' }
const TEXTAREA_WIDTH_STYLE = { width: '100%' }

const providerLabelMap: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  custom: '自定义兼容接口',
}

const providerOptions = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenAI', value: 'openai' },
]

const currentAiSourceText = computed(() => {
  const ai = userSettingsStore.settings.ai
  const providerText = formatProvider(ai.source === 'personal' ? ai.effective.provider : ai.systemDefault.provider)
  if (ai.source === 'personal')
    return `个人 ${providerText}`
  return providerText === '--' ? '系统内置 AI' : `系统内置 ${providerText}`
})
const currentAiSourceType = computed(() =>
  userSettingsStore.settings.ai.source === 'personal' ? 'success' : 'info',
)
const systemDefaultStateText = computed(() => {
  const source = userSettingsStore.settings.ai.systemDefault.source
  if (source === 'agent_runtime')
    return '可用（运行中）'
  if (source === 'agent_env_fallback')
    return '可用（本地配置）'
  if (source === 'system_config')
    return '可用（系统配置）'
  return '未配置'
})
const systemDefaultStateType = computed(() => (
  userSettingsStore.settings.ai.systemDefault.source === 'none' ? 'warning' : 'success'
))
const aiSourceAlertType = computed(() => {
  if (userSettingsStore.settings.ai.source === 'personal')
    return 'success'
  return userSettingsStore.settings.ai.systemDefault.source === 'none' ? 'warning' : 'info'
})
const aiSourceHintText = computed(() => {
  const ai = userSettingsStore.settings.ai
  if (ai.source === 'personal')
    return '当前分析和回测会优先使用你的个人 Key。清空个人 Key 后会回退到系统内置 AI。'
  if (ai.systemDefault.source === 'agent_runtime')
    return '未配置个人 Key 时，会自动使用系统内置 AI。'
  if (ai.systemDefault.source === 'agent_env_fallback')
    return '未配置个人 Key 时，会自动使用系统内置 AI。当前运行中的 Agent 状态暂未确认，已按本地 Agent 配置推断。'
  if (ai.systemDefault.source === 'system_config')
    return '未配置个人 Key 时，会自动使用系统配置中的内置 AI。'
  return '当前系统内置 AI 不可用，请联系管理员检查 Agent 默认 LLM 配置。'
})

function formatProvider(value: string | undefined) {
  const key = String(value || '').trim().toLowerCase()
  return providerLabelMap[key] || (key || '--')
}

function toPersonalProvider(value: string | undefined): PersonalAiProvider | '' {
  const key = String(value || '').trim().toLowerCase()
  return key === 'deepseek' || key === 'openai' ? key : ''
}

function pickDefaultPersonalProvider(): PersonalAiProvider {
  return toPersonalProvider(userSettingsStore.settings.ai.systemDefault.provider) || 'deepseek'
}

function syncAiForm() {
  const ai = userSettingsStore.settings.ai
  originalPersonalProvider.value = ai.personalProvider
  personalProviderInput.value = ai.personalProvider || pickDefaultPersonalProvider()
  apiTokenInput.value = ai.hasToken
    ? (ai.apiTokenMasked || MASKED_TOKEN)
    : ''
}

function validate(): string[] {
  const issues: string[] = []
  const settings = userSettingsStore.settings

  if (!Number.isFinite(settings.simulation.initialCapital) || settings.simulation.initialCapital <= 0)
    issues.push('初始资金必须大于 0')

  if (settings.strategy.positionMaxPct < 0 || settings.strategy.positionMaxPct > 100)
    issues.push('仓位上限需在 0-100 之间')
  if (settings.strategy.stopLossPct < 0 || settings.strategy.stopLossPct > 100)
    issues.push('止损阈值需在 0-100 之间')
  if (settings.strategy.takeProfitPct < 0 || settings.strategy.takeProfitPct > 100)
    issues.push('止盈阈值需在 0-100 之间')

  if (!personalProviderInput.value)
    issues.push('请选择个人 AI 提供商')

  if (settings.ai.requiresProviderReselection && apiTokenInput.value === MASKED_TOKEN)
    issues.push('检测到旧版 AI 提供商配置，请重新选择 DeepSeek 或 OpenAI 并重新输入 API Key')

  if (
    apiTokenInput.value === MASKED_TOKEN
    && originalPersonalProvider.value
    && personalProviderInput.value
    && personalProviderInput.value !== originalPersonalProvider.value
  ) {
    issues.push('切换提供商时请重新输入对应 API Key')
  }

  return issues
}

async function load() {
  try {
    await userSettingsStore.fetchMySettings()
    syncAiForm()
  }
  catch {}
}

async function save() {
  saveErrors.value = validate()
  if (saveErrors.value.length > 0)
    return

  const result = await userSettingsStore.saveMySettings({
    simulation: {
      accountName: userSettingsStore.settings.simulation.accountName,
      accountId: userSettingsStore.settings.simulation.accountId,
      initialCapital: userSettingsStore.settings.simulation.initialCapital,
      note: userSettingsStore.settings.simulation.note,
    },
    ai: {
      provider: personalProviderInput.value || undefined,
      apiToken: apiTokenInput.value,
    },
    strategy: {
      positionMaxPct: userSettingsStore.settings.strategy.positionMaxPct,
      stopLossPct: userSettingsStore.settings.strategy.stopLossPct,
      takeProfitPct: userSettingsStore.settings.strategy.takeProfitPct,
    },
  })

  if (!result.success) {
    window.$message.error(result.error || '保存失败')
    return
  }

  syncAiForm()
  window.$message.success('个人设置已保存到你的账户配置')
}

function reloadFromServer() {
  window.$dialog.warning({
    title: '重新加载确认',
    content: '将丢弃未保存修改，并从服务器重新加载个人设置，是否继续？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      saveErrors.value = []
      void load()
    },
  })
}

onMounted(() => {
  void load()
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="我的设置">
      <template #header-extra>
        <n-button @click="router.push('/profile/trading')">
          前往交易账户中心
        </n-button>
      </template>

      <n-space vertical :size="12">
        <n-text depth="3">
          仅影响 Agent 的 paper 运行默认参数，不会直接绑定券商交易账户。
        </n-text>

        <n-descriptions :column="3" bordered>
          <n-descriptions-item label="用户">
            {{ username }}
          </n-descriptions-item>
          <n-descriptions-item label="角色">
            {{ roleText }}
          </n-descriptions-item>
          <n-descriptions-item label="最后保存">
            {{ lastSavedAt }}
          </n-descriptions-item>
        </n-descriptions>
      </n-space>
    </n-card>

    <n-alert v-if="userSettingsStore.error" type="error">
      {{ userSettingsStore.error }}
    </n-alert>

    <n-spin :show="userSettingsStore.loading">
      <n-grid :cols="24" :x-gap="16" :y-gap="16" responsive="screen">
        <n-grid-item :span="24" :l-span="10">
          <n-space vertical :size="16">
            <n-card title="策略速设">
              <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
                <n-grid-item :span="24" :m-span="8">
                  <n-form-item label="仓位上限(%)">
                    <n-input-number
                      v-model:value="userSettingsStore.settings.strategy.positionMaxPct"
                      :min="0"
                      :max="100"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="8">
                  <n-form-item label="止损阈值(%)">
                    <n-input-number
                      v-model:value="userSettingsStore.settings.strategy.stopLossPct"
                      :min="0"
                      :max="100"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="8">
                  <n-form-item label="止盈阈值(%)">
                    <n-input-number
                      v-model:value="userSettingsStore.settings.strategy.takeProfitPct"
                      :min="0"
                      :max="100"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                  </n-form-item>
                </n-grid-item>
              </n-grid>
            </n-card>

            <n-card title="Paper 运行参数">
              <n-space vertical :size="12">
                <n-alert type="info">
                  这里是 paper 模式默认参数，不会绑定或修改券商交易账户。
                </n-alert>

                <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
                  <n-grid-item :span="24" :m-span="12">
                    <n-form-item label="初始资金">
                      <n-input-number
                        v-model:value="userSettingsStore.settings.simulation.initialCapital"
                        :min="1"
                        :precision="2"
                        :style="CONTROL_WIDTH_STYLE"
                      />
                    </n-form-item>
                  </n-grid-item>
                  <n-grid-item :span="24">
                    <n-form-item label="备注">
                      <n-input
                        v-model:value="userSettingsStore.settings.simulation.note"
                        type="textarea"
                        :autosize="{ minRows: 2, maxRows: 4 }"
                        placeholder="可选，记录该模拟盘用途"
                        :style="TEXTAREA_WIDTH_STYLE"
                      />
                    </n-form-item>
                  </n-grid-item>
                </n-grid>

                <n-collapse>
                  <n-collapse-item title="高级参数（可选）" name="simulation-advanced">
                    <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
                      <n-grid-item :span="24" :m-span="12">
                        <n-form-item label="账户名称">
                          <n-input
                            v-model:value="userSettingsStore.settings.simulation.accountName"
                            placeholder="例如：我的模拟盘A"
                            :style="CONTROL_WIDTH_STYLE"
                          />
                        </n-form-item>
                      </n-grid-item>
                      <n-grid-item :span="24" :m-span="12">
                        <n-form-item label="账户 ID">
                          <n-input
                            v-model:value="userSettingsStore.settings.simulation.accountId"
                            placeholder="例如：SIM-001"
                            :style="CONTROL_WIDTH_STYLE"
                          />
                        </n-form-item>
                      </n-grid-item>
                    </n-grid>
                  </n-collapse-item>
                </n-collapse>
              </n-space>
            </n-card>
          </n-space>
        </n-grid-item>

        <n-grid-item :span="24" :l-span="14">
          <n-space vertical :size="16">
            <n-card title="个人 AI 配置">
              <n-space vertical :size="12">
                <n-alert :type="aiSourceAlertType">
                  <template #header>
                    当前生效来源
                  </template>
                  <n-space align="center" :size="8">
                    <n-tag :type="currentAiSourceType" size="small">
                      {{ currentAiSourceText }}
                    </n-tag>
                    <n-tag v-if="userSettingsStore.settings.ai.hasToken" type="success" size="small">
                      已保存个人 Key
                    </n-tag>
                    <n-text depth="3">
                      {{ aiSourceHintText }}
                    </n-text>
                  </n-space>
                </n-alert>

                <n-alert
                  v-if="userSettingsStore.settings.ai.requiresProviderReselection"
                  type="warning"
                >
                  检测到旧版 AI 提供商配置，请重新选择 DeepSeek 或 OpenAI，并重新输入对应的 API Key。
                </n-alert>

                <n-descriptions bordered :column="1" label-placement="left">
                  <n-descriptions-item label="系统内置提供商">
                    {{ formatProvider(userSettingsStore.settings.ai.systemDefault.provider) }}
                  </n-descriptions-item>
                  <n-descriptions-item label="系统内置模型">
                    {{ userSettingsStore.settings.ai.systemDefault.model || '--' }}
                  </n-descriptions-item>
                  <n-descriptions-item label="系统内置 Base URL">
                    <n-text depth="3">
                      {{ userSettingsStore.settings.ai.systemDefault.baseUrl || '--' }}
                    </n-text>
                  </n-descriptions-item>
                  <n-descriptions-item label="系统内置状态">
                    <n-tag :type="systemDefaultStateType" size="small">
                      {{ systemDefaultStateText }}
                    </n-tag>
                  </n-descriptions-item>
                </n-descriptions>

                <n-form-item label="个人提供商">
                  <n-select
                    v-model:value="personalProviderInput"
                    :options="providerOptions"
                    placeholder="选择你要使用的 AI 提供商"
                    :style="CONTROL_WIDTH_STYLE"
                  />
                </n-form-item>

                <n-form-item label="个人 API Key">
                  <n-space vertical :size="8">
                    <n-input
                      v-model:value="apiTokenInput"
                      type="password"
                      show-password-on="click"
                      placeholder="输入你的个人 API Key；留空则回退系统内置 AI"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                    <n-text depth="3">
                      保持 `******` 表示不修改当前 Key；清空后保存会删除个人 Key，并立即回退到系统内置 AI。
                    </n-text>
                  </n-space>
                </n-form-item>
              </n-space>
            </n-card>

            <n-card title="保存前校验">
              <template #footer>
                <n-space justify="end">
                  <n-button @click="reloadFromServer">
                    重新加载
                  </n-button>
                  <n-button type="primary" :loading="userSettingsStore.saving" @click="save">
                    保存设置
                  </n-button>
                </n-space>
              </template>
              <n-alert v-for="issue in saveErrors" :key="issue" type="error">
                {{ issue }}
              </n-alert>
            </n-card>
          </n-space>
        </n-grid-item>
      </n-grid>
    </n-spin>
  </n-space>
</template>
