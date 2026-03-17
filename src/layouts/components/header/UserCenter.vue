<script setup lang="ts">
// 用户中心下拉组件负责展示当前用户信息和常用账户操作。
import { useSessionStore } from '@/store'
import { renderIcon } from '@/utils/icon'

const router = useRouter()
const sessionStore = useSessionStore()

const username = computed(() => sessionStore.currentUser?.username || '游客')
const roleLabel = computed(() => {
  if (sessionStore.isAdmin)
    return '管理员'
  return '普通用户'
})

const options = computed(() => {
  const base = [
    {
      label: `${username.value} · ${roleLabel.value}`,
      key: 'profileInfo',
      disabled: true,
      icon: renderIcon('icon-park-outline:user-business'),
    },
    {
      label: '我的设置',
      key: 'profileSettings',
      icon: renderIcon('icon-park-outline:setting-config'),
    },
    {
      label: '交易账户中心',
      key: 'profileTrading',
      icon: renderIcon('icon-park-outline:stock-market'),
    },
  ] as Array<Record<string, unknown>>

  if (sessionStore.isAdmin) {
    base.push(
      {
        label: '系统配置',
        key: 'systemConfig',
        icon: renderIcon('icon-park-outline:config'),
      },
    )
  }

  base.push(
    {
      type: 'divider',
      key: 'divider',
    },
    {
      label: '退出登录',
      key: 'logout',
      icon: renderIcon('icon-park-outline:logout'),
    },
  )

  return base
})

function handleSelect(key: string | number) {
  if (key === 'profileInfo')
    return

  if (key === 'profileSettings') {
    router.push('/profile/settings')
    return
  }

  if (key === 'profileTrading') {
    router.push('/profile/trading')
    return
  }

  if (key === 'systemConfig') {
    router.push('/system/config')
    return
  }

  if (key === 'logout') {
    window.$dialog.info({
      title: '确认退出',
      content: '是否退出当前会话？',
      positiveText: '确认',
      negativeText: '取消',
      onPositiveClick: async () => {
        await sessionStore.doLogout()
        router.push('/login')
      },
    })
  }
}
</script>

<template>
  <n-dropdown trigger="click" :options="options" @select="handleSelect">
    <n-avatar class="cursor-pointer" aria-label="用户菜单">
      <template #fallback>
        <div class="wh-full flex-center">
          <icon-park-outline-user />
        </div>
      </template>
    </n-avatar>
  </n-dropdown>
</template>
