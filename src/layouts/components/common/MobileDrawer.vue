<script setup lang="ts">
import UserCenter from '../header/UserCenter.vue'

const showDrawer = defineModel<boolean>('show', { default: false })
</script>

<template>
  <n-drawer
    v-model:show="showDrawer"
    :width="280"
    placement="right"
    :mask-closable="true"
    :close-on-esc="true"
  >
    <n-drawer-content :native-scrollbar="false" :body-content-style="{ padding: '0' }">
      <template #header>
        <div class="flex items-center">
          <UserCenter />
        </div>
      </template>

      <slot />
    </n-drawer-content>
  </n-drawer>
</template>
