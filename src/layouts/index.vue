<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import SimulationBindModal from '@/components/trading/SimulationBindModal.vue'
import { useAppStore, useBrokerAccountStore, useRouteStore, useSessionStore, useTradingAccountStore } from '@/store'
import {
  BackTop,
  Breadcrumb,
  CollapaseButton,
  Logo,
  MobileDrawer,
  TabBar,
  UserCenter,
} from './components'
import Content from './Content.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const routeStore = useRouteStore()
const sessionStore = useSessionStore()
const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const showMobileDrawer = ref(false)
const onboardingChecking = ref(false)
const lastOnboardingStatusErrorAt = ref(0)

const sidebarWidth = 240
const sidebarCollapsedWidth = 64

const menuOptions = computed(() => routeStore.menus as MenuOption[])

const menuValue = computed(() => {
  return routeStore.activeMenu || route.path
})

const bindModalVisible = computed({
  get: () => brokerAccountStore.bindModalVisible,
  set: (value: boolean) => {
    if (value) {
      brokerAccountStore.openBindModal()
    }
    else {
      brokerAccountStore.closeBindModal()
    }
  },
})

function handleMenuSelect(key: string) {
  if (route.path !== key)
    router.push(key)
  showMobileDrawer.value = false
}

async function refreshSimulationOnboarding(force = false) {
  if (route.path === '/login' || !sessionStore.loggedIn) {
    brokerAccountStore.closeBindModal()
    return
  }

  if (onboardingChecking.value)
    return

  onboardingChecking.value = true
  try {
    await brokerAccountStore.ensureSimulationStatus(force)
  }
  catch {
    const now = Date.now()
    if (now - lastOnboardingStatusErrorAt.value > 15000) {
      window.$message.warning('账户状态获取失败，请检查后端或 Agent 服务')
      lastOnboardingStatusErrorAt.value = now
    }
    brokerAccountStore.openBindModal()
    return
  }
  finally {
    onboardingChecking.value = false
  }

  const status = brokerAccountStore.simulationStatus
  if (status?.isBound && status?.isVerified) {
    brokerAccountStore.clearOnboardingDismissedAt()
    brokerAccountStore.closeBindModal()
    return
  }

  if (brokerAccountStore.shouldShowSimulationOnboarding()) {
    brokerAccountStore.openBindModal()
  }
}

function handleBindModalDismissed() {
  brokerAccountStore.dismissOnboardingForHours()
}

async function handleBindModalBound() {
  brokerAccountStore.clearOnboardingDismissedAt()
  await Promise.allSettled([
    tradingAccountStore.loadOverview({ refresh: true }),
    tradingAccountStore.loadDetails({ refresh: true }),
  ])
}

watch(
  () => [route.fullPath, sessionStore.loggedIn, sessionStore.currentUser?.username],
  () => {
    void refreshSimulationOnboarding(false)
  },
  { immediate: true },
)
</script>

<template>
  <n-layout has-sider style="height: 100%;">
    <n-layout-sider
      v-if="!appStore.isMobile && appStore.layoutMode === 'vertical'"
      :collapsed="appStore.collapsed"
      :collapsed-width="sidebarCollapsedWidth"
      :width="sidebarWidth"
      bordered
      collapse-mode="width"
      show-trigger="bar"
      @update:collapsed="(value) => appStore.collapsed = value"
    >
      <Logo v-if="appStore.showLogo" />
      <n-menu
        :value="menuValue"
        :collapsed="appStore.collapsed"
        :collapsed-width="sidebarCollapsedWidth"
        :options="menuOptions"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header v-if="appStore.layoutMode === 'vertical'" bordered>
        <n-space justify="space-between" align="center" style="width: 100%; height: 60px; padding: 0 16px;">
          <n-space align="center">
            <n-button v-if="appStore.isMobile" quaternary @click="showMobileDrawer = true">
              <template #icon>
                <n-icon>
                  <icon-park-outline-hamburger-button />
                </n-icon>
              </template>
            </n-button>
            <template v-else>
              <CollapaseButton />
              <Breadcrumb v-if="appStore.showBreadcrumb" />
            </template>
          </n-space>

          <UserCenter />
        </n-space>
      </n-layout-header>

      <n-layout-content>
        <n-card
          v-if="appStore.showTabs || appStore.layoutMode === 'full-content'"
          v-show="appStore.showTabs && appStore.layoutMode === 'vertical'"
          :bordered="false"
          size="small"
        >
          <TabBar />
        </n-card>
        <Content />
      </n-layout-content>

      <n-layout-footer v-if="appStore.showFooter && appStore.layoutMode === 'vertical'" bordered>
        <n-space justify="center" style="padding: 10px 0;">
          {{ appStore.footerText }}
        </n-space>
      </n-layout-footer>
    </n-layout>

    <BackTop />

    <MobileDrawer v-model:show="showMobileDrawer">
      <n-menu
        :value="menuValue"
        :options="menuOptions"
        @update:value="handleMenuSelect"
      />
    </MobileDrawer>

    <SimulationBindModal
      v-model:show="bindModalVisible"
      @dismissed="handleBindModalDismissed"
      @bound="handleBindModalBound"
    />
  </n-layout>
</template>
