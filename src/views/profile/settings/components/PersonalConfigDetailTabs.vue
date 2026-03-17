<script setup lang="ts">
import type { PersonalAiProvider, UserSettingsResponse } from '@/types/user-settings'
import type {
  PersonalConfigClientInfo,
  PersonalConfigDetailTab,
  PersonalConfigFeedbackType,
  PersonalConfigPasswordForm,
} from '../types'

// 详细设置组件只负责承接表单和展示，不承担保存逻辑。
defineProps<{
  username: string
  displayName: string
  userIdText: string
  roleText: string
  lastSavedAt: string
  currentAiSourceText: string
  currentAiSourceType: PersonalConfigFeedbackType
  aiSourceAlertType: PersonalConfigFeedbackType
  aiSourceHintText: string
  systemDefaultStateText: string
  systemDefaultStateType: PersonalConfigFeedbackType
  systemProviderText: string
  systemModelText: string
  systemBaseUrlText: string
  providerOptions: Array<{ label: string, value: PersonalAiProvider }>
  clientInfo: PersonalConfigClientInfo
  hasPendingChanges: boolean
  hasPersonalAiToken: boolean
  hasSystemAi: boolean
  aiBindingActionLabel: string
  aiBindingDisabled: boolean
  aiBindingError: string
  aiBindingSubmitting: boolean
  canUnbindAiBinding: boolean
  personalBindingAvailable: boolean
  personalBindingIssue: string
  passwordChangeable: boolean
  passwordError: string
  passwordSubmitting: boolean
  requiresProviderReselection: boolean
  maskedToken: string
}>()

const emit = defineEmits<{
  openTrading: []
  saveAiBinding: []
  submitPasswordChange: []
  unbindAiBinding: []
}>()

const activeTab = defineModel<PersonalConfigDetailTab>('activeTab', { required: true })
const settings = defineModel<UserSettingsResponse>('settings', { required: true })
const personalProvider = defineModel<PersonalAiProvider | null>('personalProvider', { required: true })
const personalModel = defineModel<string>('personalModel', { required: true })
const apiToken = defineModel<string>('apiToken', { required: true })
const passwordForm = defineModel<PersonalConfigPasswordForm>('passwordForm', { required: true })
const isSiliconFlowSelected = computed(() => personalProvider.value === 'siliconflow')
const siliconFlowBaseUrl = 'https://api.siliconflow.cn/v1'

const notificationItems = [
  {
    title: '分析任务提醒',
    description: '分析完成后沿用系统默认的站内提醒策略。',
  },
  {
    title: '回测结果提醒',
    description: '回测任务完成与失败消息当前统一走系统默认通知。',
  },
  {
    title: '系统消息',
    description: '账号相关消息仍由平台统一下发，个人通知偏好后续可扩展。',
  },
]
</script>

<template>
  <n-card title="详细设置" :segmented="{ content: 'soft' }">
    <template #header-extra>
      <n-text depth="3">
        所有修改都在这里完成
      </n-text>
    </template>

    <n-tabs v-model:value="activeTab" type="line" animated>
      <!-- 账号基础信息与本地模拟盘备注。 -->
      <n-tab-pane name="basic" tab="基础信息">
        <n-space vertical :size="16">
          <n-card embedded title="账户身份">
            <n-descriptions
              class="personal-config-detail-descriptions"
              bordered
              :column="1"
              label-placement="left"
            >
              <n-descriptions-item label="显示名称">
                {{ displayName }}
              </n-descriptions-item>
              <n-descriptions-item label="用户名">
                {{ username }}
              </n-descriptions-item>
              <n-descriptions-item label="账号 ID">
                {{ userIdText }}
              </n-descriptions-item>
              <n-descriptions-item label="角色">
                {{ roleText }}
              </n-descriptions-item>
              <n-descriptions-item label="当前 AI 来源">
                <n-tag :type="currentAiSourceType" size="small">
                  {{ currentAiSourceText }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="最近同步">
                {{ lastSavedAt }}
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-card embedded title="Paper 账户资料">
            <n-form label-placement="top" :show-feedback="false">
              <n-grid cols="1 s:2 m:2" responsive="screen" :x-gap="16" :y-gap="8">
                <n-form-item-gi label="账户名称">
                  <n-input
                    v-model:value="settings.simulation.accountName"
                    placeholder="例如：我的模拟盘 A"
                  />
                </n-form-item-gi>
                <n-form-item-gi label="账户 ID">
                  <n-input
                    v-model:value="settings.simulation.accountId"
                    placeholder="例如：SIM-001"
                  />
                </n-form-item-gi>
                <n-form-item-gi :span="2" label="备注">
                  <n-input
                    v-model:value="settings.simulation.note"
                    type="textarea"
                    :autosize="{ minRows: 3, maxRows: 5 }"
                    placeholder="记录这个模拟盘的用途、策略方向或提醒信息"
                  />
                </n-form-item-gi>
              </n-grid>
            </n-form>
          </n-card>
        </n-space>
      </n-tab-pane>

      <!-- 这些字段会写回个人账户配置，作为后续 Agent paper 运行默认值。 -->
      <n-tab-pane name="preferences" tab="运行默认值">
        <n-space vertical :size="16">
          <n-alert type="info">
            MVP 版本已固定为中文、浅色和经典后台布局。这里保留会写回账户配置的运行默认值与策略参数。
          </n-alert>

          <n-card embedded title="默认行为与策略">
            <n-form label-placement="top" :show-feedback="false">
              <n-grid cols="1 s:2 m:4" responsive="screen" :x-gap="16" :y-gap="8">
                <n-form-item-gi label="初始资金">
                  <n-input-number
                    v-model:value="settings.simulation.initialCapital"
                    :min="1"
                    :precision="2"
                  />
                </n-form-item-gi>

                <n-form-item-gi label="仓位上限(%)">
                  <n-input-number
                    v-model:value="settings.strategy.positionMaxPct"
                    :min="0"
                    :max="100"
                  />
                </n-form-item-gi>

                <n-form-item-gi label="止损阈值(%)">
                  <n-input-number
                    v-model:value="settings.strategy.stopLossPct"
                    :min="0"
                    :max="100"
                  />
                </n-form-item-gi>

                <n-form-item-gi label="止盈阈值(%)">
                  <n-input-number
                    v-model:value="settings.strategy.takeProfitPct"
                    :min="0"
                    :max="100"
                  />
                </n-form-item-gi>
              </n-grid>
            </n-form>
          </n-card>

          <n-card embedded title="当前浏览器环境">
            <n-descriptions
              class="personal-config-detail-descriptions"
              bordered
              :column="1"
              label-placement="left"
            >
              <n-descriptions-item label="浏览器">
                {{ clientInfo.browser }}
              </n-descriptions-item>
              <n-descriptions-item label="设备平台">
                {{ clientInfo.platform }}
              </n-descriptions-item>
              <n-descriptions-item label="浏览器时区">
                {{ clientInfo.timezone }}
              </n-descriptions-item>
              <n-descriptions-item label="浏览器语言">
                {{ clientInfo.locale }}
              </n-descriptions-item>
            </n-descriptions>
          </n-card>
        </n-space>
      </n-tab-pane>

      <!-- 安全中心把改密和 AI 凭据回退状态放在一起，方便统一理解风险面。 -->
      <n-tab-pane name="security" tab="安全中心">
        <n-space vertical :size="16">
          <n-alert :type="requiresProviderReselection ? 'warning' : 'info'">
            <template #header>
              登录与运行安全概览
            </template>
            {{ requiresProviderReselection ? '检测到旧版 AI 提供商配置，请在“账号绑定”中重新选择 DeepSeek、OpenAI 或 SiliconFlow，并输入新的 API Key。' : '当前登录状态正常，安全风险主要围绕 AI 凭据与系统回退状态。' }}
          </n-alert>

          <n-card embedded title="登录与安全状态">
            <n-descriptions
              class="personal-config-detail-descriptions"
              bordered
              :column="1"
              label-placement="left"
            >
              <n-descriptions-item label="登录状态">
                <n-tag type="success" size="small">
                  正常
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="角色级别">
                {{ roleText }}
              </n-descriptions-item>
              <n-descriptions-item label="个人 Key">
                <n-tag :type="hasPersonalAiToken ? 'success' : 'default'" size="small">
                  {{ hasPersonalAiToken ? '已保存' : '未保存' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="系统回退">
                <n-tag :type="hasSystemAi ? 'success' : 'warning'" size="small">
                  {{ hasSystemAi ? '可用' : '不可用' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="系统默认状态">
                <n-tag :type="systemDefaultStateType" size="small">
                  {{ systemDefaultStateText }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="网页改密">
                <n-tag :type="passwordChangeable ? 'success' : 'warning'" size="small">
                  {{ passwordChangeable ? '可用' : '不可用' }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item label="最近同步">
                {{ lastSavedAt }}
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-card embedded title="修改密码">
            <n-space vertical :size="12">
              <n-alert v-if="!passwordChangeable" type="warning">
                当前环境不支持网页改密，请联系管理员通过后台处理。
              </n-alert>

              <n-form label-placement="top" :show-feedback="false">
                <n-grid cols="1 s:2 m:2" responsive="screen" :x-gap="16" :y-gap="8">
                  <n-form-item-gi :span="2" label="当前密码">
                    <n-input
                      v-model:value="passwordForm.currentPassword"
                      type="password"
                      show-password-on="click"
                      placeholder="请输入当前密码"
                      :disabled="!passwordChangeable || passwordSubmitting"
                    />
                  </n-form-item-gi>

                  <n-form-item-gi label="新密码">
                    <n-input
                      v-model:value="passwordForm.newPassword"
                      type="password"
                      show-password-on="click"
                      placeholder="请输入 8-64 位新密码"
                      :disabled="!passwordChangeable || passwordSubmitting"
                    />
                  </n-form-item-gi>

                  <n-form-item-gi label="确认新密码">
                    <n-input
                      v-model:value="passwordForm.newPasswordConfirm"
                      type="password"
                      show-password-on="click"
                      placeholder="请再次输入新密码"
                      :disabled="!passwordChangeable || passwordSubmitting"
                    />
                  </n-form-item-gi>
                </n-grid>
              </n-form>

              <n-text depth="3">
                修改成功后会保持当前登录状态；密码长度需为 8-64 位。
              </n-text>

              <n-alert v-if="passwordError" type="error">
                {{ passwordError }}
              </n-alert>

              <n-flex justify="end">
                <n-button
                  type="primary"
                  :loading="passwordSubmitting"
                  :disabled="!passwordChangeable"
                  @click="emit('submitPasswordChange')"
                >
                  更新密码
                </n-button>
              </n-flex>
            </n-space>
          </n-card>
        </n-space>
      </n-tab-pane>

      <!-- 通知中心目前仍是只读占位，但布局已经按可扩展的配置面板保留。 -->
      <n-tab-pane name="notifications" tab="通知中心">
        <n-space vertical :size="16">
          <n-alert type="info">
            当前个人通知策略尚未开放单独配置。分析、回测与系统消息会沿用平台默认规则，后续接入新字段后这块可以直接承接到现有 Bento 布局里。
          </n-alert>

          <n-card embedded title="当前通知行为">
            <n-list hoverable>
              <n-list-item v-for="item in notificationItems" :key="item.title">
                <n-thing :title="item.title" :description="item.description" />
                <template #suffix>
                  <n-tag type="info" size="small">
                    系统默认
                  </n-tag>
                </template>
              </n-list-item>
            </n-list>
          </n-card>
        </n-space>
      </n-tab-pane>

      <!-- 账号绑定单独处理个人 AI Key，避免和其它账户设置共享提交按钮。 -->
      <n-tab-pane name="integrations" tab="账号绑定">
        <n-space vertical :size="16">
          <n-alert :type="aiSourceAlertType">
            <template #header>
              当前生效来源
            </template>
            <n-space align="center" :size="8" wrap>
              <n-tag :type="currentAiSourceType" size="small">
                {{ currentAiSourceText }}
              </n-tag>
              <n-tag v-if="hasPersonalAiToken" type="success" size="small">
                已保存个人 Key
              </n-tag>
              <n-text depth="3">
                {{ aiSourceHintText }}
              </n-text>
            </n-space>
          </n-alert>

          <n-alert v-if="requiresProviderReselection" type="warning">
            检测到旧版 AI 提供商配置，请重新选择 DeepSeek、OpenAI 或 SiliconFlow，并重新输入对应的 API Key。
          </n-alert>

          <n-card embedded title="系统内置 AI">
            <n-descriptions
              class="personal-config-detail-descriptions"
              bordered
              :column="1"
              label-placement="left"
            >
              <n-descriptions-item label="系统提供商">
                {{ systemProviderText }}
              </n-descriptions-item>
              <n-descriptions-item label="系统模型">
                {{ systemModelText }}
              </n-descriptions-item>
              <n-descriptions-item label="Base URL">
                <span class="personal-config-detail-value">{{ systemBaseUrlText }}</span>
              </n-descriptions-item>
              <n-descriptions-item label="运行状态">
                <n-tag :type="systemDefaultStateType" size="small">
                  {{ systemDefaultStateText }}
                </n-tag>
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-card embedded title="个人 AI 授权">
            <n-space vertical :size="12">
              <n-alert v-if="!personalBindingAvailable" type="warning">
                当前后端尚未完成个人 AI Key 加密配置，SiliconFlow、OpenAI 和 DeepSeek 的个人绑定都会失败。{{ personalBindingIssue }}
              </n-alert>

              <n-alert type="info">
                “{{ aiBindingActionLabel }}”只会保存当前 AI 提供商、模型和 API Key。页面顶部“保存更改”继续负责基础资料与策略参数。
              </n-alert>

              <n-form label-placement="top" :show-feedback="false">
                <n-grid cols="1 s:2 m:2" responsive="screen" :x-gap="16" :y-gap="8">
                  <n-form-item-gi :span="2" label="个人提供商">
                    <n-radio-group v-model:value="personalProvider">
                      <n-space>
                        <n-radio-button
                          v-for="option in providerOptions"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </n-radio-button>
                      </n-space>
                    </n-radio-group>
                  </n-form-item-gi>

                  <n-form-item-gi :span="2" label="个人 API Key">
                    <n-space vertical :size="8">
                      <n-input
                        v-model:value="apiToken"
                        type="password"
                        show-password-on="click"
                        placeholder="输入你的个人 API Key；留空则回退系统内置 AI"
                      />
                      <n-text depth="3">
                        保持 {{ maskedToken }} 表示不修改当前 Key；如需删除个人 Key，请使用下方“解除绑定”。
                      </n-text>
                    </n-space>
                  </n-form-item-gi>

                  <template v-if="isSiliconFlowSelected">
                    <n-form-item-gi :span="2" label="模型名称">
                      <n-input
                        v-model:value="personalModel"
                        placeholder="例如：Pro/deepseek-ai/DeepSeek-V3"
                      />
                    </n-form-item-gi>

                    <n-form-item-gi :span="2" label="接口地址">
                      <n-space vertical :size="8">
                        <n-input :value="siliconFlowBaseUrl" readonly />
                        <n-text depth="3">
                          SiliconFlow 个人绑定固定走官方兼容地址，当前页面仅允许你切换模型名称。
                        </n-text>
                      </n-space>
                    </n-form-item-gi>
                  </template>
                </n-grid>
              </n-form>

              <n-alert v-if="aiBindingError" type="error">
                {{ aiBindingError }}
              </n-alert>

              <n-flex justify="end" :size="12" wrap>
                <n-button
                  v-if="canUnbindAiBinding"
                  secondary
                  type="warning"
                  :disabled="aiBindingSubmitting"
                  @click="emit('unbindAiBinding')"
                >
                  解除绑定
                </n-button>
                <n-button
                  type="primary"
                  :loading="aiBindingSubmitting"
                  :disabled="aiBindingDisabled"
                  @click="emit('saveAiBinding')"
                >
                  {{ aiBindingActionLabel }}
                </n-button>
              </n-flex>
            </n-space>
          </n-card>

          <n-card embedded title="关联入口">
            <n-space vertical :size="12">
              <n-text depth="3">
                交易账户绑定与资金管理仍在交易账户中心维护。这里保留为入口，不与个人 AI 配置混在同一张表单里。
              </n-text>
              <n-button secondary type="primary" @click="emit('openTrading')">
                前往交易账户中心
              </n-button>
            </n-space>
          </n-card>
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<style scoped>
.personal-config-detail-value {
  display: block;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.personal-config-detail-descriptions :deep(.n-descriptions-table-header) {
  width: 136px;
  min-width: 136px;
  vertical-align: top;
  white-space: nowrap;
}

.personal-config-detail-descriptions :deep(.n-descriptions-table-content) {
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
