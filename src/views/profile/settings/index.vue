<script setup lang="ts">
import PersonalConfigDetailTabs from './components/PersonalConfigDetailTabs.vue'
import PersonalConfigOverview from './components/PersonalConfigOverview.vue'
import { usePersonalConfigPage } from './composables/usePersonalConfigPage'

// 页面本身只负责组装总览卡和详情标签页，业务状态全部下沉到 composable。
const {
  MASKED_TOKEN,
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
  goTradingCenter,
  hasPendingChanges,
  hasPersonalAiToken,
  hasSystemAi,
  lastSavedAt,
  passwordChangeable,
  passwordError,
  passwordForm,
  passwordSubmitting,
  personalBindingAvailable,
  personalBindingIssue,
  personalModelInput,
  personalProviderInput,
  providerOptions,
  reloadFromServer,
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
} = usePersonalConfigPage()
</script>

<template>
  <n-space vertical :size="16">
    <PersonalConfigOverview
      :display-name="displayName"
      :username="username"
      :user-id-text="userIdText"
      :role-text="roleText"
      :scope-text="scopeText"
      :last-saved-at="lastSavedAt"
      :status-tags="appStatusTags"
      :has-pending-changes="hasPendingChanges"
      :save-errors="saveErrors"
      :saving="userSettingsStore.saving"
      @open-trading="goTradingCenter"
      @reset="reloadFromServer"
      @save="saveAll"
    />

    <n-alert v-if="userSettingsStore.error" type="error">
      {{ userSettingsStore.error }}
    </n-alert>

    <n-spin :show="userSettingsStore.loading">
      <n-space vertical :size="16">
        <PersonalConfigDetailTabs
          v-model:active-tab="activeDetailTab"
          v-model:settings="userSettingsStore.settings"
          v-model:personal-provider="personalProviderInput"
          v-model:personal-model="personalModelInput"
          v-model:api-token="apiTokenInput"
          v-model:password-form="passwordForm"
          :username="username"
          :display-name="displayName"
          :user-id-text="userIdText"
          :role-text="roleText"
          :last-saved-at="lastSavedAt"
          :current-ai-source-text="currentAiSourceText"
          :current-ai-source-type="currentAiSourceType"
          :ai-source-alert-type="aiSourceAlertType"
          :ai-source-hint-text="aiSourceHintText"
          :system-default-state-text="systemDefaultStateText"
          :system-default-state-type="systemDefaultStateType"
          :system-provider-text="systemProviderText"
          :system-model-text="systemModelText"
          :system-base-url-text="systemBaseUrlText"
          :provider-options="providerOptions"
          :client-info="clientInfo"
          :has-pending-changes="hasPendingChanges"
          :has-personal-ai-token="hasPersonalAiToken"
          :has-system-ai="hasSystemAi"
          :ai-binding-action-label="aiBindingActionLabel"
          :ai-binding-disabled="aiBindingDisabled"
          :ai-binding-error="aiBindingError"
          :ai-binding-submitting="aiBindingSubmitting"
          :can-unbind-ai-binding="canUnbindAiBinding"
          :personal-binding-available="personalBindingAvailable"
          :personal-binding-issue="personalBindingIssue"
          :password-changeable="passwordChangeable"
          :password-error="passwordError"
          :password-submitting="passwordSubmitting"
          :requires-provider-reselection="userSettingsStore.settings.ai.requiresProviderReselection"
          :masked-token="MASKED_TOKEN"
          @open-trading="goTradingCenter"
          @save-ai-binding="saveAiBinding"
          @submit-password-change="submitPasswordChange"
          @unbind-ai-binding="unbindAiBinding"
        />
      </n-space>
    </n-spin>
  </n-space>
</template>
