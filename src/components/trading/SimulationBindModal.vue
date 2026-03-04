<script setup lang="ts">
import { useBrokerAccountStore, useTradingAccountStore } from '@/store'

const props = withDefaults(defineProps<{
  show?: boolean
}>(), {
  show: false,
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'bound'): void
  (e: 'dismissed'): void
}>()

const router = useRouter()
const brokerAccountStore = useBrokerAccountStore()
const tradingAccountStore = useTradingAccountStore()

const binding = ref(false)
const bindForm = reactive({
  accountUid: '',
  accountDisplayName: '',
  initialCapital: 100000,
  commissionRate: 0.0003,
  slippageBps: 2,
})

const hasHistoricalAccountUid = computed(() => {
  const statusAccountUid = brokerAccountStore.simulationStatus?.accountUid?.trim()
  return Boolean(statusAccountUid && bindForm.accountUid.trim() && bindForm.accountUid.trim() === statusAccountUid)
})
const bindInlineError = computed(() => brokerAccountStore.bindError || brokerAccountStore.error)

function handleDismiss() {
  if (binding.value)
    return
  emit('update:show', false)
  emit('dismissed')
}

function goToTradingCenter() {
  emit('update:show', false)
  emit('dismissed')
  router.push('/profile/trading')
}

function clearAccountUidInput() {
  bindForm.accountUid = ''
}

function validateForm(): string | null {
  if (!Number.isFinite(bindForm.initialCapital) || bindForm.initialCapital <= 0)
    return '初始资金必须大于 0'
  if (!Number.isFinite(bindForm.commissionRate) || bindForm.commissionRate < 0)
    return '手续费率必须大于等于 0'
  if (!Number.isFinite(bindForm.slippageBps) || bindForm.slippageBps < 0)
    return '滑点(bps)必须大于等于 0'
  return null
}

async function bindNow() {
  brokerAccountStore.clearBindError()
  const validationError = validateForm()
  if (validationError) {
    window.$message.error(validationError)
    return
  }

  binding.value = true
  try {
    await brokerAccountStore.bindSimulation({
      accountUid: bindForm.accountUid.trim() || undefined,
      accountDisplayName: bindForm.accountDisplayName.trim() || undefined,
      initialCapital: Number(bindForm.initialCapital),
      commissionRate: Number(bindForm.commissionRate),
      slippageBps: Number(bindForm.slippageBps),
    })

    await Promise.allSettled([
      tradingAccountStore.loadOverview({ refresh: true }),
      tradingAccountStore.loadDetails({ refresh: true }),
    ])

    window.$message.success('Backtrader 模拟账户初始化成功')
    emit('bound')
    emit('update:show', false)
  }
  catch {
    window.$message.error(brokerAccountStore.error || '模拟账户初始化失败')
  }
  finally {
    binding.value = false
  }
}

watch(() => props.show, (visible) => {
  if (!visible)
    return

  brokerAccountStore.clearBindError()

  const status = brokerAccountStore.simulationStatus
  if (!bindForm.accountUid.trim() && status?.accountUid)
    bindForm.accountUid = status.accountUid
  if (!bindForm.accountDisplayName.trim() && status?.accountDisplayName)
    bindForm.accountDisplayName = status.accountDisplayName
})
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    :close-on-esc="false"
    preset="card"
    style="width: min(760px, 94vw)"
    title="初始化模拟账户"
    @update:show="(value) => { if (!value) handleDismiss() }"
  >
    <n-space vertical :size="14">
      <n-alert type="info" :show-icon="false">
        填写参数后将创建并绑定本地 Backtrader 模拟账户。
      </n-alert>

      <n-form label-placement="top">
        <n-grid :cols="24" :x-gap="12">
          <n-grid-item :span="24" :l-span="12">
            <n-form-item label="账户标识（可选）">
              <n-input v-model:value="bindForm.accountUid" placeholder="留空则自动生成，例如 bt-user-1" />
            </n-form-item>
            <n-space vertical :size="4">
              <n-text depth="3" class="text-12px">
                可留空自动生成，也可手动填写本地账户标识。
              </n-text>
              <n-button v-if="bindForm.accountUid" text size="small" @click="clearAccountUidInput">
                {{ hasHistoricalAccountUid ? '清空历史标识' : '清空输入' }}
              </n-button>
            </n-space>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="12">
            <n-form-item label="显示名（可选）">
              <n-input v-model:value="bindForm.accountDisplayName" placeholder="例如：我的本地模拟盘" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="8">
            <n-form-item label="初始资金">
              <n-input-number
                v-model:value="bindForm.initialCapital"
                :min="1"
                :step="1000"
                class="w-full"
                placeholder="例如：100000"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="8">
            <n-form-item label="手续费率">
              <n-input-number
                v-model:value="bindForm.commissionRate"
                :min="0"
                :step="0.0001"
                :precision="6"
                class="w-full"
                placeholder="例如：0.0003"
              />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="8">
            <n-form-item label="滑点（bps）">
              <n-input-number
                v-model:value="bindForm.slippageBps"
                :min="0"
                :step="0.5"
                :precision="2"
                class="w-full"
                placeholder="例如：2"
              />
            </n-form-item>
          </n-grid-item>
        </n-grid>
      </n-form>

      <n-alert v-if="bindInlineError" type="error">
        {{ bindInlineError }}
      </n-alert>
      <n-text depth="3">
        `paper` 仅分析，`auto` 会自动向本地模拟盘下单。
      </n-text>
    </n-space>

    <template #footer>
      <n-space justify="space-between" :wrap="true">
        <n-button quaternary @click="goToTradingCenter">
          前往交易账户中心
        </n-button>
        <n-space>
          <n-button @click="handleDismiss">
            稍后再说
          </n-button>
          <n-button type="primary" :loading="binding || brokerAccountStore.submitting" @click="bindNow">
            初始化并校验
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>
