<script setup lang="ts">
import type { AiProvider } from '@/types/user-settings'
import { useSessionStore, useUserSettingsStore } from '@/store'
import { formatDateTime } from '@/utils/stock'

const router = useRouter()
const sessionStore = useSessionStore()
const userSettingsStore = useUserSettingsStore()

const saveErrors = ref<string[]>([])
const apiTokenInput = ref('')

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Custom', value: 'custom' },
]

const username = computed(() => sessionStore.currentUser?.username || '--')
const roleText = computed(() => sessionStore.isSuperAdmin ? '管理员' : '普通用户')
const lastSavedAt = computed(() => {
  if (!userSettingsStore.settings.updatedAt)
    return '--'
  return formatDateTime(userSettingsStore.settings.updatedAt)
})
const CONTROL_WIDTH_STYLE = { width: '100%', maxWidth: '320px' }
const TEXTAREA_WIDTH_STYLE = { width: '100%' }

function syncTokenInput() {
  const ai = userSettingsStore.settings.ai
  apiTokenInput.value = ai.hasToken
    ? (ai.apiTokenMasked || '******')
    : ''
}

watch(() => userSettingsStore.settings.ai.provider, (value) => {
  if (value === 'openai' && !userSettingsStore.settings.ai.baseUrl.trim()) {
    userSettingsStore.settings.ai.baseUrl = 'https://api.openai.com/v1'
  }
  if (value === 'deepseek' && !userSettingsStore.settings.ai.baseUrl.trim()) {
    userSettingsStore.settings.ai.baseUrl = 'https://api.deepseek.com'
  }
})

function validate(): string[] {
  const issues: string[] = []
  const settings = userSettingsStore.settings

  if (!Number.isFinite(settings.simulation.initialCapital) || settings.simulation.initialCapital <= 0)
    issues.push('初始资金必须大于 0')

  if (!settings.ai.baseUrl.trim())
    issues.push('请填写 AI Base URL')
  if (!settings.ai.model.trim())
    issues.push('请填写 AI 模型名称')

  if (settings.strategy.positionMaxPct < 0 || settings.strategy.positionMaxPct > 100)
    issues.push('仓位上限需在 0-100 之间')
  if (settings.strategy.stopLossPct < 0 || settings.strategy.stopLossPct > 100)
    issues.push('止损阈值需在 0-100 之间')
  if (settings.strategy.takeProfitPct < 0 || settings.strategy.takeProfitPct > 100)
    issues.push('止盈阈值需在 0-100 之间')

  return issues
}

function handleProviderChange(value: string) {
  const provider = value as AiProvider
  userSettingsStore.settings.ai.provider = provider
  if (provider === 'openai' && !userSettingsStore.settings.ai.baseUrl.trim()) {
    userSettingsStore.settings.ai.baseUrl = 'https://api.openai.com/v1'
  }
  if (provider === 'deepseek' && !userSettingsStore.settings.ai.baseUrl.trim()) {
    userSettingsStore.settings.ai.baseUrl = 'https://api.deepseek.com'
  }
}

async function load() {
  try {
    await userSettingsStore.fetchMySettings()
    syncTokenInput()
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
      provider: userSettingsStore.settings.ai.provider,
      baseUrl: userSettingsStore.settings.ai.baseUrl,
      model: userSettingsStore.settings.ai.model,
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

  syncTokenInput()
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
              <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen">
                <n-grid-item :span="24" :m-span="12">
                  <n-form-item label="提供商">
                    <n-select
                      v-model:value="userSettingsStore.settings.ai.provider"
                      :options="providerOptions"
                      :style="CONTROL_WIDTH_STYLE"
                      @update:value="handleProviderChange"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-form-item label="模型">
                    <n-input
                      v-model:value="userSettingsStore.settings.ai.model"
                      placeholder="例如：gpt-4o-mini / deepseek-chat"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-form-item label="Base URL">
                    <n-input
                      v-model:value="userSettingsStore.settings.ai.baseUrl"
                      placeholder="例如：https://api.openai.com/v1"
                      :style="CONTROL_WIDTH_STYLE"
                    />
                  </n-form-item>
                </n-grid-item>
                <n-grid-item :span="24" :m-span="12">
                  <n-form-item label="API Token">
                    <n-space vertical :size="8">
                      <n-input
                        v-model:value="apiTokenInput"
                        type="password"
                        show-password-on="click"
                        placeholder="输入新 Token 以更新"
                        :style="CONTROL_WIDTH_STYLE"
                      />
                      <n-text depth="3">
                        留空将清除 Token；保持 ****** 表示不修改。
                      </n-text>
                    </n-space>
                  </n-form-item>
                </n-grid-item>
              </n-grid>
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
