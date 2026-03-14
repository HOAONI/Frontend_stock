export type PersonalConfigDetailTab = 'basic' | 'preferences' | 'security' | 'notifications' | 'integrations'

export type PersonalConfigColorMode = 'light' | 'dark' | 'auto'
export type PersonalConfigFeedbackType = 'default' | 'error' | 'info' | 'success' | 'warning'

export interface PersonalConfigStatusTag {
  label: string
  type?: NaiveUI.ThemeColor
}

export interface PersonalConfigClientInfo {
  browser: string
  platform: string
  timezone: string
  locale: string
}

export interface PersonalConfigPasswordForm {
  currentPassword: string
  newPassword: string
  newPasswordConfirm: string
}
