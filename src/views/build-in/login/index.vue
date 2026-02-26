<script setup lang="ts">
import { useSessionStore } from '@/store'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()

type AuthTab = 'login' | 'register'

const appName = import.meta.env.VITE_APP_NAME
const usernamePattern = /^[a-z]\w{2,31}$/i
const activeTab = ref<AuthTab>('login')

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
})

const loginSubmitting = ref(false)
const registerSubmitting = ref(false)
const loginError = ref('')
const registerError = ref('')

function resolveRedirect(): string {
  const redirect = String(route.query.redirect ?? '')
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    return import.meta.env.VITE_HOME_PATH
  }
  return redirect
}

function validateUsername(username: string): string | undefined {
  if (!username.trim()) {
    return '请输入用户名'
  }
  if (!usernamePattern.test(username.trim())) {
    return '用户名需 3-32 位且以字母开头，只能包含字母、数字和下划线'
  }
}

function validatePassword(password: string): string | undefined {
  if (!password) {
    return '请输入密码'
  }
  if (password.length < 8 || password.length > 64) {
    return '密码长度需为 8-64 位'
  }
}

function validateLoginForm(): string | undefined {
  return validateUsername(loginForm.username) || validatePassword(loginForm.password)
}

function validateRegisterForm(): string | undefined {
  return validateUsername(registerForm.username)
    || validatePassword(registerForm.password)
    || (!registerForm.confirmPassword ? '请确认密码' : undefined)
    || (registerForm.password !== registerForm.confirmPassword ? '两次输入的密码不一致' : undefined)
}

async function submitLogin() {
  loginError.value = ''
  const validationError = validateLoginForm()
  if (validationError) {
    loginError.value = validationError
    return
  }

  loginSubmitting.value = true
  const result = await sessionStore.doLogin(loginForm.username.trim(), loginForm.password)
  loginSubmitting.value = false

  if (!result.success) {
    loginError.value = result.error || '登录失败'
    return
  }

  router.replace(resolveRedirect())
}

async function submitRegister() {
  registerError.value = ''

  const validationError = validateRegisterForm()
  if (validationError) {
    registerError.value = validationError
    return
  }

  registerSubmitting.value = true
  const result = await sessionStore.doRegister({
    username: registerForm.username.trim(),
    displayName: registerForm.displayName.trim() || undefined,
    password: registerForm.password,
    confirmPassword: registerForm.confirmPassword,
  })
  registerSubmitting.value = false

  if (!result.success) {
    registerError.value = result.error || '注册失败，请稍后重试'
    registerForm.password = ''
    registerForm.confirmPassword = ''
    return
  }

  window.$message.success('注册成功，正在进入系统')
  router.replace(import.meta.env.VITE_HOME_PATH)
}

onMounted(async () => {
  try {
    await sessionStore.ensureStatus()
    if (!sessionStore.authEnabled || sessionStore.loggedIn) {
      router.replace(import.meta.env.VITE_HOME_PATH)
    }
  }
  catch {
    loginError.value = '无法连接后端服务，请检查 Backend_stock 是否已启动'
    registerError.value = '无法连接后端服务，请检查 Backend_stock 是否已启动'
  }
})
</script>

<template>
  <n-el class="wh-full flex-center" style="background-color: var(--body-color);">
    <n-card class="w-460px max-w-90vw" size="large" :bordered="false">
      <template #header>
        <div class="text-center">
          <div class="text-24px font-600">
            {{ appName }}
          </div>
          <div class="mt-1 text-14px text-color3">
            标准账号认证
          </div>
        </div>
      </template>

      <n-tabs v-model:value="activeTab" animated>
        <n-tab-pane name="login" tab="登录">
          <n-form @submit.prevent="submitLogin">
            <n-form-item label="用户名">
              <n-input v-model:value="loginForm.username" placeholder="请输入用户名" />
            </n-form-item>

            <n-form-item label="密码">
              <n-input v-model:value="loginForm.password" type="password" show-password-on="click" placeholder="请输入密码" />
            </n-form-item>

            <n-alert v-if="loginError" type="error" class="mb-4">
              {{ loginError }}
            </n-alert>

            <n-button type="primary" attr-type="submit" block :loading="loginSubmitting">
              登录
            </n-button>
          </n-form>
        </n-tab-pane>

        <n-tab-pane name="register" tab="注册">
          <n-form @submit.prevent="submitRegister">
            <n-alert type="info" class="mb-4">
              新注册账号默认创建为普通用户（analyst）
            </n-alert>
            <n-form-item label="用户名">
              <n-input v-model:value="registerForm.username" placeholder="字母开头，3-32 位" />
            </n-form-item>

            <n-form-item label="显示名">
              <n-input v-model:value="registerForm.displayName" placeholder="可选" />
            </n-form-item>

            <n-form-item label="密码">
              <n-input
                v-model:value="registerForm.password"
                type="password"
                show-password-on="click"
                placeholder="请输入 8-64 位密码"
              />
            </n-form-item>

            <n-form-item label="确认密码">
              <n-input
                v-model:value="registerForm.confirmPassword"
                type="password"
                show-password-on="click"
                placeholder="请再次输入密码"
              />
            </n-form-item>

            <n-alert v-if="registerError" type="error" class="mb-4">
              {{ registerError }}
            </n-alert>

            <n-button type="primary" attr-type="submit" block :loading="registerSubmitting">
              注册
            </n-button>
          </n-form>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </n-el>
</template>
