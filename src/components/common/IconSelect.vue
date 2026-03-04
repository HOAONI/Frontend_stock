<script setup lang="ts">
interface Props {
  disabled?: boolean
}

const {
  disabled = false,
} = defineProps<Props>()

interface IconList {
  prefix: string
  icons: string[]
  title: string
  total: number
  categories?: Record<string, string[]>
  uncategorized?: string[]
}

const value = defineModel('value', { type: String })

const nameList = ['icon-park-outline', 'carbon', 'ant-design']

async function fetchIconList(name: string): Promise<IconList> {
  return await fetch(`https://api.iconify.design/collection?prefix=${name}`).then(res => res.json())
}

async function fetchIconAllList(list: string[]) {
  const targets = await Promise.all(list.map(fetchIconList))

  const iconList = targets.map((item) => {
    const icons = [
      ...(item.categories ? Object.values(item.categories).flat() : []),
      ...(item.uncategorized ? Object.values(item.uncategorized).flat() : []),
    ]
    return { ...item, icons }
  })

  const svgNames = Object.keys(import.meta.glob('@/assets/svg-icons/*.svg')).map(
    path => path.split('/').pop()?.replace('.svg', ''),
  ).filter(Boolean) as string[]

  iconList.unshift({
    prefix: 'local',
    title: 'Local Icons',
    icons: svgNames,
    total: svgNames.length,
    uncategorized: svgNames,
  })

  return iconList
}

const iconList = shallowRef<IconList[]>([])

onMounted(async () => {
  iconList.value = await fetchIconAllList(nameList)
})

const currentTab = shallowRef(0)
const currentTag = shallowRef('')
const searchValue = ref('')
const currentPage = shallowRef(1)

function handleChangeTab(index: number) {
  currentTab.value = index
  currentTag.value = ''
  currentPage.value = 1
}

function handleSelectIconTag(icon: string) {
  currentTag.value = currentTag.value === icon ? '' : icon
  currentPage.value = 1
}

const icons = computed(() => {
  if (!iconList.value[currentTab.value])
    return []
  const hasTag = !!currentTag.value
  return hasTag
    ? iconList.value[currentTab.value]?.categories?.[currentTag.value] || []
    : iconList.value[currentTab.value].icons || []
})

const filteredIcons = computed(() => {
  return icons.value?.filter(i => i.includes(searchValue.value)) || []
})

const visibleIcons = computed(() => {
  return filteredIcons.value.slice((currentPage.value - 1) * 200, currentPage.value * 200)
})

const showModal = ref(false)

function handleSelectIcon(icon: string) {
  value.value = icon
  showModal.value = false
}

function clearIcon() {
  value.value = ''
  showModal.value = false
}
</script>

<template>
  <n-input-group disabled>
    <n-button v-if="value" :disabled="disabled" type="primary">
      <template #icon>
        <nova-icon :icon="value" />
      </template>
    </n-button>
    <n-input :value="value" readonly :placeholder="$t('components.iconSelector.inputPlaceholder')" />
    <n-button type="primary" ghost :disabled="disabled" @click="showModal = true">
      {{ $t('common.choose') }}
    </n-button>
  </n-input-group>

  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="$t('components.iconSelector.selectorTitle')"
    size="small"
    class="w-800px"
    :bordered="false"
  >
    <template #header-extra>
      <n-button type="warning" size="small" ghost @click="clearIcon">
        {{ $t('components.iconSelector.clearIcon') }}
      </n-button>
    </template>

    <n-tabs :value="currentTab" type="line" animated placement="left" @update:value="handleChangeTab">
      <n-tab-pane v-for="(list, index) in iconList" :key="list.prefix" :name="index" :tab="list.title">
        <n-space vertical :size="12">
          <n-space :wrap="true">
            <n-tag
              v-for="(_v, k) in list.categories"
              :key="k"
              :checked="currentTag === k"
              checkable
              size="small"
              @update:checked="handleSelectIconTag(k)"
            >
              {{ k }}
            </n-tag>
          </n-space>

          <n-input
            v-model:value="searchValue"
            type="text"
            clearable
            :placeholder="$t('components.iconSelector.searchPlaceholder')"
          />

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px;">
            <n-button
              v-for="icon in visibleIcons"
              :key="icon"
              quaternary
              :title="`${list.prefix}:${icon}`"
              @click="handleSelectIcon(`${list.prefix}:${icon}`)"
            >
              <nova-icon :icon="`${list.prefix}:${icon}`" :size="22" />
            </n-button>
          </div>

          <n-empty v-if="visibleIcons.length === 0" />

          <n-space justify="center">
            <n-pagination
              v-model:page="currentPage"
              :item-count="filteredIcons.length"
              :page-size="200"
            />
          </n-space>
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </n-modal>
</template>
