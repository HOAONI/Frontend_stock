import type { AxiosError } from 'axios'
import type {
  AgentChatExecutionPolicy,
  AgentChatResponseStyle,
  PersonalAiProvider,
  UpdateUserSettingsRequest,
} from '@/types/user-settings'
import type {
  PersonalConfigClientInfo,
  PersonalConfigDetailTab,
  PersonalConfigFeedbackType,
  PersonalConfigPasswordForm,
  PersonalConfigStatusTag,
} from '../types'
import { updateMyUserSettings } from '@/api/user-settings'
import { useSessionStore, useUserSettingsStore } from '@/store'
import { formatDateTime } from '@/utils/stock'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 64
const DEFAULT_SILICONFLOW_MODEL = 'Pro/deepseek-ai/DeepSeek-V3'
const DEFAULT_PERSONAL_TOKEN_READ_ISSUE = '当前保存的个人 API Key 无法回显，请重新输入并保存；如问题持续，请检查 PERSONAL_SECRET_KEY 配置。'

const providerLabelMap: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  siliconflow: 'SiliconFlow',
  custom: '自定义兼容接口',
}

function normalizeText(value: unknown, fallback = '未设置'): string {
  const text = String(value ?? '').trim()
  return text || fallback
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined')
    return '当前浏览器'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('edg/'))
    return 'Microsoft Edge'
  if (ua.includes('chrome/') && !ua.includes('edg/'))
    return 'Google Chrome'
  if (ua.includes('safari/') && !ua.includes('chrome/'))
    return 'Safari'
  if (ua.includes('firefox/'))
    return 'Firefox'
  return '当前浏览器'
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined')
    return '当前设备'

  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac os x'))
    return 'macOS'
  if (ua.includes('windows nt'))
    return 'Windows'
  if (ua.includes('iphone') || ua.includes('ipad'))
    return 'iOS'
  if (ua.includes('android'))
    return 'Android'
  if (ua.includes('linux'))
    return 'Linux'
  return '当前设备'
}

function collectClientInfo(): PersonalConfigClientInfo {
  const timezone = typeof Intl !== 'undefined'
    ? normalizeText(Intl.DateTimeFormat().resolvedOptions().timeZone, '浏览器自动')
    : '浏览器自动'

  return {
    browser: detectBrowser(),
    platform: detectPlatform(),
    timezone,
    locale: typeof navigator !== 'undefined'
      ? normalizeText(navigator.language, '浏览器自动')
      : '浏览器自动',
  }
}

function clonePayload(payload: UpdateUserSettingsRequest): UpdateUserSettingsRequest {
  return JSON.parse(JSON.stringify(payload)) as UpdateUserSettingsRequest
}

function extractMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError?.response?.data?.message || fallback
}

/**
 * 个人设置页拆成三条独立保存链路：
 * 基础资料、AI 绑定、密码修改互不影响，便于局部失败时保留其余表单状态。
 */
export function usePersonalConfigPage() {
  const router = useRouter()
  const sessionStore = useSessionStore()
  const userSettingsStore = useUserSettingsStore()

  const saveErrors = ref<string[]>([])
  const aiBindingError = shallowRef('')
  const aiBindingSubmitting = shallowRef(false)
  const apiTokenInput = shallowRef('')
  const personalModelInput = shallowRef('')
  const personalProviderInput = shallowRef<PersonalAiProvider | null>(null)
  const originalPersonalProvider = shallowRef<PersonalAiProvider | ''>('')
  const originalPersonalApiToken = shallowRef('')
  const activeDetailTab = shallowRef<PersonalConfigDetailTab>('basic')
  const aiBaselinePayload = shallowRef<UpdateUserSettingsRequest | null>(null)
  const settingsBaselinePayload = shallowRef<UpdateUserSettingsRequest | null>(null)
  const clientInfo = shallowRef<PersonalConfigClientInfo>(collectClientInfo())
  const passwordSubmitting = shallowRef(false)
  const passwordError = shallowRef('')
  const passwordForm = reactive<PersonalConfigPasswordForm>({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  })

  const providerOptions = [
    { label: 'DeepSeek', value: 'deepseek' as PersonalAiProvider },
    { label: 'OpenAI', value: 'openai' as PersonalAiProvider },
    { label: 'SiliconFlow', value: 'siliconflow' as PersonalAiProvider },
  ]
  const executionPolicyOptions = [
    { label: '条件满足直接执行', value: 'auto_execute_if_condition_met' as AgentChatExecutionPolicy },
    { label: '始终先确认', value: 'confirm_before_execute' as AgentChatExecutionPolicy },
  ]
  const responseStyleOptions = [
    { label: '简洁事实型', value: 'concise_factual' as AgentChatResponseStyle },
    { label: '平衡说明型', value: 'balanced' as AgentChatResponseStyle },
    { label: '详细解释型', value: 'detailed' as AgentChatResponseStyle },
  ]

  const username = computed(() => normalizeText(sessionStore.currentUser?.username, '访客'))
  const displayName = computed(() => normalizeText(sessionStore.currentUser?.displayName || sessionStore.currentUser?.username, '访客'))
  const userIdText = computed(() => normalizeText(sessionStore.currentUser?.id, '未分配'))
  const roleText = computed(() => sessionStore.isAdmin ? '管理员' : '普通用户')
  const scopeText = '仅影响 Agent 的 paper 运行默认参数与对话行为'
  const lastSavedAt = computed(() => {
    if (!userSettingsStore.settings.updatedAt)
      return '尚未同步'
    return formatDateTime(userSettingsStore.settings.updatedAt)
  })

  const currentSettingsPayload = computed<UpdateUserSettingsRequest>(() => ({
    simulation: {
      accountName: userSettingsStore.settings.simulation.accountName,
      accountId: userSettingsStore.settings.simulation.accountId,
      initialCapital: userSettingsStore.settings.simulation.initialCapital,
      note: userSettingsStore.settings.simulation.note,
    },
    strategy: {
      positionMaxPct: userSettingsStore.settings.strategy.positionMaxPct,
      stopLossPct: userSettingsStore.settings.strategy.stopLossPct,
      takeProfitPct: userSettingsStore.settings.strategy.takeProfitPct,
    },
    agentChat: {
      executionPolicy: userSettingsStore.settings.agentChat.executionPolicy,
      confirmationShortcutsEnabled: userSettingsStore.settings.agentChat.confirmationShortcutsEnabled,
      followupFocusResolutionEnabled: userSettingsStore.settings.agentChat.followupFocusResolutionEnabled,
      responseStyle: userSettingsStore.settings.agentChat.responseStyle,
    },
  }))

  const currentAiSourceText = computed(() => {
    const ai = userSettingsStore.settings.ai
    const providerText = formatProvider(ai.source === 'personal'
      ? (ai.personalProvider || ai.effective.provider)
      : ai.systemDefault.provider)
    if (ai.source === 'personal')
      return `个人 ${providerText}`
    return providerText === '未设置' ? '系统内置 AI' : `系统内置 ${providerText}`
  })

  const currentAiSourceType = computed<PersonalConfigFeedbackType>(() =>
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

  const systemDefaultStateType = computed<PersonalConfigFeedbackType>(() => (
    userSettingsStore.settings.ai.systemDefault.source === 'none' ? 'warning' : 'success'
  ))

  const aiSourceAlertType = computed<PersonalConfigFeedbackType>(() => {
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

  const hasSystemAi = computed(() => userSettingsStore.settings.ai.systemDefault.source !== 'none')
  const hasPersonalAiToken = computed(() => userSettingsStore.settings.ai.hasToken)
  const personalTokenReadable = computed(() =>
    !hasPersonalAiToken.value || userSettingsStore.settings.ai.apiTokenReadable,
  )
  const personalTokenReadIssue = computed(() =>
    userSettingsStore.settings.ai.apiTokenReadIssue || DEFAULT_PERSONAL_TOKEN_READ_ISSUE,
  )
  const mustResubmitApiToken = computed(() =>
    userSettingsStore.settings.ai.requiresProviderReselection || !personalTokenReadable.value,
  )
  const personalBindingAvailable = computed(() => userSettingsStore.settings.ai.personalBindingAvailable)
  const personalBindingIssue = computed(() =>
    userSettingsStore.settings.ai.personalBindingIssue || '后端尚未完成个人 AI Key 加密配置，请联系管理员检查 PERSONAL_SECRET_KEY。',
  )
  const passwordChangeable = computed(() => sessionStore.passwordChangeable)
  const systemProviderText = computed(() => formatProvider(userSettingsStore.settings.ai.systemDefault.provider))
  const systemModelText = computed(() => normalizeText(userSettingsStore.settings.ai.systemDefault.model))
  const systemBaseUrlText = computed(() => normalizeText(userSettingsStore.settings.ai.systemDefault.baseUrl, '未提供'))

  const appStatusTags = computed<PersonalConfigStatusTag[]>(() => [
    {
      label: roleText.value,
      type: sessionStore.isAdmin ? 'primary' : 'info',
    },
    {
      label: currentAiSourceText.value,
      type: currentAiSourceType.value,
    },
    {
      label: '配置按模块保存',
      type: 'default',
    },
  ])

  const hasPendingChanges = computed(() => {
    if (!settingsBaselinePayload.value)
      return false
    return JSON.stringify(currentSettingsPayload.value) !== JSON.stringify(settingsBaselinePayload.value)
  })

  const hasSavedPersonalBindingConfig = computed(() =>
    Boolean(userSettingsStore.settings.ai.personalProvider),
  )

  const hasPendingAiBindingChanges = computed(() => {
    if (!aiBaselinePayload.value)
      return false
    return JSON.stringify(currentAiPayload.value) !== JSON.stringify(aiBaselinePayload.value)
  })

  const aiBindingActionLabel = computed(() =>
    hasPersonalAiToken.value || hasSavedPersonalBindingConfig.value ? '更新绑定' : '绑定',
  )

  const canUnbindAiBinding = computed(() => hasPersonalAiToken.value)

  const aiBindingDisabled = computed(() => {
    const apiToken = normalizeApiTokenInput()

    if (aiBindingSubmitting.value)
      return true
    if (!personalBindingAvailable.value)
      return true
    if (!personalProviderInput.value)
      return true
    if (personalProviderInput.value === 'siliconflow' && !personalModelInput.value.trim())
      return true
    if (mustResubmitApiToken.value && !apiToken)
      return true
    if (hasPersonalAiToken.value && !hasPendingAiBindingChanges.value)
      return true
    if (!hasPersonalAiToken.value && !apiToken)
      return true
    if (hasPersonalAiToken.value && !apiToken)
      return true
    return false
  })

  function formatProvider(value: string | undefined): string {
    const key = String(value || '').trim().toLowerCase()
    return providerLabelMap[key] || normalizeText(key)
  }

  function toPersonalProvider(value: string | undefined): PersonalAiProvider | '' {
    const key = String(value || '').trim().toLowerCase()
    return key === 'deepseek' || key === 'openai' || key === 'siliconflow' ? key : ''
  }

  function pickDefaultPersonalProvider(): PersonalAiProvider {
    return toPersonalProvider(userSettingsStore.settings.ai.systemDefault.provider) || 'deepseek'
  }

  function normalizeApiTokenInput(): string {
    return apiTokenInput.value.trim()
  }

  function buildCurrentAiPayload(): UpdateUserSettingsRequest {
    const provider = personalProviderInput.value || undefined
    const model = personalProviderInput.value === 'siliconflow'
      ? personalModelInput.value.trim()
      : undefined
    const apiToken = normalizeApiTokenInput()
    const providerChanged = Boolean(
      provider
      && originalPersonalProvider.value
      && provider !== originalPersonalProvider.value,
    )
    const tokenChanged = apiToken !== originalPersonalApiToken.value
    const shouldIncludeApiToken = mustResubmitApiToken.value
      || providerChanged
      || tokenChanged
      || (hasPersonalAiToken.value && apiToken === '')

    return {
      ai: {
        provider,
        model,
        ...(shouldIncludeApiToken ? { apiToken } : {}),
      },
    }
  }

  const currentAiPayload = computed<UpdateUserSettingsRequest>(() => buildCurrentAiPayload())

  function syncAiForm() {
    const ai = userSettingsStore.settings.ai
    originalPersonalProvider.value = ai.personalProvider
    originalPersonalApiToken.value = ai.apiToken || ''
    personalProviderInput.value = ai.personalProvider || pickDefaultPersonalProvider()
    personalModelInput.value = ai.personalProvider === 'siliconflow'
      ? (ai.personalModel || DEFAULT_SILICONFLOW_MODEL)
      : ''
    apiTokenInput.value = ai.apiToken || ''
    aiBindingError.value = ''
  }

  function syncSettingsBaseline() {
    settingsBaselinePayload.value = clonePayload(currentSettingsPayload.value)
  }

  function syncAiBaseline() {
    aiBaselinePayload.value = clonePayload(currentAiPayload.value)
  }

  function validateSettings(): string[] {
    const issues: string[] = []
    const settings = userSettingsStore.settings

    if (!Number.isFinite(settings.simulation.initialCapital) || settings.simulation.initialCapital <= 0)
      issues.push('初始资金必须大于 0。')

    if (settings.strategy.positionMaxPct < 0 || settings.strategy.positionMaxPct > 100)
      issues.push('仓位上限需在 0-100 之间。')
    if (settings.strategy.stopLossPct < 0 || settings.strategy.stopLossPct > 100)
      issues.push('止损阈值需在 0-100 之间。')
    if (settings.strategy.takeProfitPct < 0 || settings.strategy.takeProfitPct > 100)
      issues.push('止盈阈值需在 0-100 之间。')
    if (!['auto_execute_if_condition_met', 'confirm_before_execute'].includes(settings.agentChat.executionPolicy))
      issues.push('条件交易执行策略不合法。')
    if (!['concise_factual', 'balanced', 'detailed'].includes(settings.agentChat.responseStyle))
      issues.push('Agent 回复风格不合法。')

    return issues
  }

  function validateAiBinding(): string | null {
    const apiToken = normalizeApiTokenInput()

    if (!personalBindingAvailable.value)
      return personalBindingIssue.value
    if (!personalProviderInput.value)
      return '请选择个人 AI 提供商。'
    if (personalProviderInput.value === 'siliconflow' && !personalModelInput.value.trim())
      return '请选择或填写 SiliconFlow 模型名称。'
    if (!personalTokenReadable.value && !apiToken)
      return personalTokenReadIssue.value
    if (userSettingsStore.settings.ai.requiresProviderReselection && !apiToken)
      return '检测到旧版 AI 提供商配置，请重新选择 DeepSeek、OpenAI 或 SiliconFlow，并确认对应的 API Key 后重新保存。'
    if (!hasPersonalAiToken.value && !apiToken)
      return '请输入个人 API Key。'
    if (hasPersonalAiToken.value && !apiToken)
      return '如需解除绑定，请使用“解除绑定”按钮。'
    return null
  }

  function goTradingCenter() {
    router.push('/profile/trading')
  }

  function resetPasswordForm() {
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.newPasswordConfirm = ''
    passwordError.value = ''
  }

  function validatePasswordForm(): string | null {
    if (!passwordForm.currentPassword)
      return '请输入当前密码'
    if (!passwordForm.newPassword)
      return '请输入新密码'
    if (!passwordForm.newPasswordConfirm)
      return '请确认新密码'
    if (passwordForm.newPassword !== passwordForm.newPasswordConfirm)
      return '两次输入的新密码不一致'
    if (passwordForm.newPassword.length < PASSWORD_MIN_LENGTH || passwordForm.newPassword.length > PASSWORD_MAX_LENGTH)
      return `密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位`
    return null
  }

  async function load() {
    try {
      await userSettingsStore.fetchMySettings()
      // 每次从服务端拉回配置后都重建 baseline，后续“是否有未保存修改”才能可靠比较。
      syncAiForm()
      syncSettingsBaseline()
      syncAiBaseline()
      saveErrors.value = []
      aiBindingError.value = ''
    }
    catch {}
  }

  async function saveAll() {
    saveErrors.value = validateSettings()
    if (saveErrors.value.length > 0)
      return

    const result = await userSettingsStore.saveMySettings(currentSettingsPayload.value)

    if (!result.success) {
      window.$message.error(result.error || '保存失败')
      return
    }

    syncSettingsBaseline()
    saveErrors.value = []
    window.$message.success('个人设置已保存到你的账户配置')
  }

  async function saveAiBinding() {
    aiBindingError.value = validateAiBinding() || ''
    if (aiBindingError.value)
      return

    userSettingsStore.error = ''
    aiBindingSubmitting.value = true
    try {
      // AI 绑定单独走接口，避免基础资料保存失败时把用户输入的 Key 一起丢掉。
      const data = await updateMyUserSettings(currentAiPayload.value)
      userSettingsStore.applyAiSettings(data)
      syncAiForm()
      syncAiBaseline()
      aiBindingError.value = ''
      window.$message.success('个人 AI 绑定已更新')
    }
    catch (error: unknown) {
      const message = extractMessage(error, '个人 AI 绑定保存失败')
      aiBindingError.value = message
      window.$message.error(message)
    }
    finally {
      aiBindingSubmitting.value = false
    }
  }

  async function doUnbindAiBinding() {
    userSettingsStore.error = ''
    aiBindingSubmitting.value = true
    try {
      const data = await updateMyUserSettings({
        ai: {
          provider: personalProviderInput.value || undefined,
          model: personalProviderInput.value === 'siliconflow'
            ? personalModelInput.value.trim()
            : undefined,
          apiToken: '',
        },
      })
      userSettingsStore.applyAiSettings(data)
      syncAiForm()
      syncAiBaseline()
      aiBindingError.value = ''
      window.$message.success('个人 AI 绑定已解除')
    }
    catch (error: unknown) {
      const message = extractMessage(error, '个人 AI 绑定解除失败')
      aiBindingError.value = message
      window.$message.error(message)
    }
    finally {
      aiBindingSubmitting.value = false
    }
  }

  function unbindAiBinding() {
    window.$dialog.warning({
      title: '解除个人 AI 绑定',
      content: '这会删除当前保存的个人 API Key，并立即回退到系统内置 AI。提供商与模型选择会保留，便于稍后重新绑定。',
      positiveText: '确认解除',
      negativeText: '取消',
      onPositiveClick: async () => {
        await doUnbindAiBinding()
      },
    })
  }

  function reloadFromServer() {
    window.$dialog.warning({
      title: '重新加载确认',
      content: '将丢弃未保存的服务端配置，并从服务器重新加载个人设置，是否继续？',
      positiveText: '确认',
      negativeText: '取消',
      onPositiveClick: () => {
        saveErrors.value = []
        aiBindingError.value = ''
        void load()
      },
    })
  }

  async function submitPasswordChange() {
    passwordError.value = validatePasswordForm() || ''
    if (passwordError.value)
      return

    if (!passwordChangeable.value) {
      passwordError.value = '当前环境不支持网页改密'
      return
    }

    passwordSubmitting.value = true
    const result = await sessionStore.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      newPasswordConfirm: passwordForm.newPasswordConfirm,
    })
    passwordSubmitting.value = false

    if (!result.success) {
      passwordError.value = result.error || '修改密码失败，请稍后重试'
      return
    }

    resetPasswordForm()
    window.$message.success('密码修改成功')
  }

  watch(currentSettingsPayload, () => {
    if (saveErrors.value.length > 0)
      saveErrors.value = validateSettings()
  }, { deep: true })

  watch(currentAiPayload, () => {
    // AI 绑定表单一旦变更，实时重跑校验，避免用户提交后才知道 provider/model 不完整。
    if (aiBindingError.value)
      aiBindingError.value = validateAiBinding() || ''
  }, { deep: true })

  watch(personalProviderInput, (value) => {
    if (value === 'siliconflow' && !personalModelInput.value.trim())
      personalModelInput.value = DEFAULT_SILICONFLOW_MODEL
  })

  watch(
    () => [passwordForm.currentPassword, passwordForm.newPassword, passwordForm.newPasswordConfirm],
    () => {
      if (passwordError.value)
        passwordError.value = validatePasswordForm() || ''
    },
  )

  onMounted(() => {
    clientInfo.value = collectClientInfo()
    void load()
  })

  return {
    activeDetailTab,
    aiBindingActionLabel,
    aiBindingDisabled,
    aiBindingError,
    aiBindingSubmitting,
    aiSourceAlertType,
    aiSourceHintText,
    appStatusTags,
    canUnbindAiBinding,
    clientInfo,
    currentAiSourceText,
    currentAiSourceType,
    displayName,
    executionPolicyOptions,
    goTradingCenter,
    hasPendingChanges,
    hasPersonalAiToken,
    hasSystemAi,
    lastSavedAt,
    load,
    personalBindingAvailable,
    personalBindingIssue,
    personalTokenReadable,
    personalTokenReadIssue,
    personalModelInput,
    personalProviderInput,
    passwordChangeable,
    passwordError,
    passwordForm,
    passwordSubmitting,
    providerOptions,
    reloadFromServer,
    resetPasswordForm,
    responseStyleOptions,
    roleText,
    saveAiBinding,
    saveAll,
    saveErrors,
    scopeText,
    submitPasswordChange,
    systemBaseUrlText,
    systemDefaultStateText,
    systemDefaultStateType,
    systemModelText,
    systemProviderText,
    userIdText,
    username,
    unbindAiBinding,
    userSettingsStore,
    apiTokenInput,
  }
}
