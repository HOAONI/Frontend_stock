<script setup lang="ts">
import { useAppStore, useRouteStore } from '@/store'
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
import { ProLayout, useLayoutMenu } from 'pro-naive-ui'

const route = useRoute()
const appStore = useAppStore()
const routeStore = useRouteStore()

const { layoutMode } = storeToRefs(useAppStore())

const {
  layout,
  activeKey,
} = useLayoutMenu({
  mode: layoutMode,
  accordion: true,
  menus: routeStore.menus as any,
}) as any

watch(() => route.path, () => {
  activeKey.value = routeStore.activeMenu
}, { immediate: true })

const showMobileDrawer = ref(false)

const sidebarWidth = ref(240)
const sidebarCollapsedWidth = ref(64)

const hasHorizontalMenu = computed(() => ['horizontal', 'mixed-two-column', 'mixed-sidebar'].includes(layoutMode.value))
const hideCollapseButton = computed(() => ['horizontal'].includes(layoutMode.value) || appStore.isMobile)
</script>

<template>
  <ProLayout
    v-model:collapsed="appStore.collapsed"
    :mode="layoutMode"
    :is-mobile="appStore.isMobile"
    :show-logo="appStore.showLogo && !appStore.isMobile"
    :show-footer="appStore.showFooter"
    :show-tabbar="appStore.showTabs"
    nav-fixed
    show-nav
    show-sidebar
    :nav-height="60"
    :tabbar-height="45"
    :footer-height="40"
    :sidebar-width="sidebarWidth"
    :sidebar-collapsed-width="sidebarCollapsedWidth"
  >
    <template #logo>
      <Logo />
    </template>

    <template #nav-left>
      <template v-if="appStore.isMobile">
        <Logo />
      </template>

      <template v-else>
        <div v-if="!hasHorizontalMenu || !hideCollapseButton" class="h-full flex-y-center gap-1 p-x-sm">
          <CollapaseButton v-if="!hideCollapseButton" />
          <Breadcrumb v-if="!hasHorizontalMenu" />
        </div>
      </template>
    </template>

    <template #nav-center>
      <div class="h-full flex-y-center gap-1">
        <n-menu v-if="hasHorizontalMenu" v-bind="layout.horizontalMenuProps" />
      </div>
    </template>

    <template #nav-right>
      <div class="h-full flex-y-center gap-1 p-x-xl">
        <template v-if="appStore.isMobile">
          <n-button quaternary @click="showMobileDrawer = true">
            <template #icon>
              <n-icon size="18">
                <icon-park-outline-hamburger-button />
              </n-icon>
            </template>
          </n-button>
        </template>
        <template v-else>
          <UserCenter />
        </template>
      </div>
    </template>

    <template #sidebar>
      <n-menu v-bind="layout.verticalMenuProps" :collapsed-width="sidebarCollapsedWidth" />
    </template>

    <template #sidebar-extra>
      <n-scrollbar class="flex-[1_0_0]">
        <n-menu v-bind="layout.verticalExtraMenuProps" :collapsed-width="sidebarCollapsedWidth" />
      </n-scrollbar>
    </template>

    <template #tabbar>
      <TabBar />
    </template>

    <template #footer>
      <div class="flex-center h-full">
        {{ appStore.footerText }}
      </div>
    </template>

    <Content />
    <BackTop />

    <MobileDrawer v-model:show="showMobileDrawer">
      <n-menu v-bind="layout.verticalMenuProps" />
    </MobileDrawer>
  </ProLayout>
</template>
