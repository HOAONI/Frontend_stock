<script setup lang="ts">
import {
  createAdminRole,
  deleteAdminRole,
  getAdminRoleDetail,
  listAdminRoles,
  updateAdminRole,
} from '@/api/admin-roles'
import type { AdminRoleItem, RolePermissionItem } from '@/types/admin-roles'
import { RBAC_MODULE_OPTIONS } from '@/types/admin-roles'
import { NSwitch } from 'naive-ui'
import { h } from 'vue'

interface PermissionEditorRow {
  moduleCode: string
  label: string
  canRead: boolean
  canWrite: boolean
}

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)

const rows = ref<AdminRoleItem[]>([])
const selectedRoleId = ref<number | null>(null)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<AdminRoleItem | null>(null)

const editVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: 0,
  roleCode: '',
  roleName: '',
  description: '',
})

const permissionRows = ref<PermissionEditorRow[]>([])

const selectedRole = computed(() => {
  if (!selectedRoleId.value)
    return null
  return rows.value.find(item => item.id === selectedRoleId.value) || null
})

function onRowClick(row: AdminRoleItem) {
  selectedRoleId.value = row.id
}

function initPermissionRows(permissions: RolePermissionItem[] = []) {
  const map = new Map<string, RolePermissionItem>()
  permissions.forEach((item) => {
    map.set(item.moduleCode, item)
  })
  permissionRows.value = RBAC_MODULE_OPTIONS.map((option) => {
    const hit = map.get(option.moduleCode)
    return {
      moduleCode: option.moduleCode,
      label: option.label,
      canRead: Boolean(hit?.canRead),
      canWrite: Boolean(hit?.canWrite),
    }
  })
}

function updateWritePermission(moduleCode: string, checked: boolean) {
  const row = permissionRows.value.find(item => item.moduleCode === moduleCode)
  if (!row)
    return
  row.canWrite = checked
  if (checked)
    row.canRead = true
}

function updateReadPermission(moduleCode: string, checked: boolean) {
  const row = permissionRows.value.find(item => item.moduleCode === moduleCode)
  if (!row)
    return
  row.canRead = checked
  if (!checked)
    row.canWrite = false
}

function getPermissionSummary(role: AdminRoleItem): string {
  if (!role.permissions.length)
    return '--'
  return role.permissions.map(item => item.moduleCode).join(', ')
}

function getSelectedPermissions(): RolePermissionItem[] {
  return permissionRows.value
    .filter(item => item.canRead || item.canWrite)
    .map(item => ({
      moduleCode: item.moduleCode,
      canRead: item.canRead || item.canWrite,
      canWrite: item.canWrite,
    }))
}

async function loadRows(reset = false) {
  if (reset)
    page.value = 1
  loading.value = true
  try {
    const result = await listAdminRoles({
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    })
    rows.value = result.items
    total.value = result.total
    if (selectedRoleId.value && !rows.value.some(item => item.id === selectedRoleId.value)) {
      selectedRoleId.value = null
    }
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载角色列表失败'
    window.$message.error(message)
  }
  finally {
    loading.value = false
  }
}

async function openDetail(id?: number) {
  const targetId = id || selectedRoleId.value
  if (!targetId) {
    window.$message.warning('请先选择角色')
    return
  }
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailData.value = await getAdminRoleDetail(targetId)
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载角色详情失败'
    window.$message.error(message)
  }
  finally {
    detailLoading.value = false
  }
}

function openCreate() {
  editMode.value = 'create'
  editForm.id = 0
  editForm.roleCode = ''
  editForm.roleName = ''
  editForm.description = ''
  initPermissionRows([])
  editVisible.value = true
}

async function openEdit() {
  if (!selectedRoleId.value) {
    window.$message.warning('请先选择角色')
    return
  }
  try {
    const detail = await getAdminRoleDetail(selectedRoleId.value)
    editMode.value = 'edit'
    editForm.id = detail.id
    editForm.roleCode = detail.roleCode
    editForm.roleName = detail.roleName
    editForm.description = detail.description || ''
    initPermissionRows(detail.permissions)
    editVisible.value = true
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载角色编辑信息失败'
    window.$message.error(message)
  }
}

function validateForm(): string | undefined {
  if (!editForm.roleCode.trim())
    return '角色编码不能为空'
  if (!editForm.roleName.trim())
    return '角色名称不能为空'
  if (getSelectedPermissions().length === 0)
    return '至少勾选一个权限模块'
}

async function submitEdit() {
  const error = validateForm()
  if (error) {
    window.$message.error(error)
    return
  }

  submitting.value = true
  try {
    const permissions = getSelectedPermissions()
    if (editMode.value === 'create') {
      await createAdminRole({
        roleCode: editForm.roleCode.trim(),
        roleName: editForm.roleName.trim(),
        description: editForm.description.trim() || undefined,
        permissions,
      })
      window.$message.success('角色创建成功')
    }
    else {
      await updateAdminRole(editForm.id, {
        roleCode: editForm.roleCode.trim(),
        roleName: editForm.roleName.trim(),
        description: editForm.description.trim() || undefined,
        permissions,
      })
      window.$message.success('角色更新成功')
    }
    editVisible.value = false
    await loadRows()
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存角色失败'
    window.$message.error(message)
  }
  finally {
    submitting.value = false
  }
}

function removeRole() {
  const current = selectedRole.value
  if (!current) {
    window.$message.warning('请先选择角色')
    return
  }
  if (current.roleCode === 'admin') {
    window.$message.warning('admin 角色禁止删除')
    return
  }
  window.$dialog.warning({
    title: '删除确认',
    content: `确认删除角色 ${current.roleName} (${current.roleCode}) 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteAdminRole(current.id)
        window.$message.success('角色删除成功')
        selectedRoleId.value = null
        await loadRows()
      }
      catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除角色失败'
        window.$message.error(message)
      }
    },
  })
}

const columns = [
  { title: 'ID', key: 'id' },
  { title: '角色编码', key: 'roleCode' },
  { title: '角色名称', key: 'roleName' },
  {
    title: '内置角色',
    key: 'isBuiltin',
    render: (row: AdminRoleItem) => (row.isBuiltin ? '是' : '否'),
  },
  {
    title: '关联用户数',
    key: 'assignedUserCount',
  },
  {
    title: '权限模块',
    key: 'permissions',
    render: (row: AdminRoleItem) => getPermissionSummary(row),
  },
  { title: '更新时间', key: 'updatedAt' },
]

onMounted(async () => {
  await loadRows(true)
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="角色管理" size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="keyword" clearable placeholder="角色编码/名称关键字" style="width: 280px" />
        <n-button :loading="loading" @click="() => loadRows(true)">
          查询
        </n-button>
      </n-space>
      <n-space class="mt-3" align="center" :wrap="true">
        <n-button type="primary" @click="openCreate">
          新增角色
        </n-button>
        <n-button :disabled="!selectedRole" @click="openEdit">
          编辑
        </n-button>
        <n-button :disabled="!selectedRole" @click="() => openDetail()">
          查看详情
        </n-button>
        <n-button type="error" :disabled="!selectedRole || selectedRole.roleCode === 'admin'" @click="removeRole">
          删除
        </n-button>
      </n-space>
    </n-card>

    <n-card size="small">
      <n-data-table
        :loading="loading"
        :columns="columns"
        :data="rows"
        :row-key="(row: AdminRoleItem) => row.id"
        :row-props="(row: AdminRoleItem) => ({ style: 'cursor:pointer', onClick: () => onRowClick(row) })"
      />
      <n-pagination
        class="mt-3"
        :page="page"
        :item-count="total"
        :page-size="limit"
        @update:page="(value) => { page = value; loadRows(); }"
      />
    </n-card>

    <n-drawer v-model:show="detailVisible" :width="560">
      <n-drawer-content title="角色详情" closable>
        <n-spin :show="detailLoading">
          <template v-if="detailData">
            <n-descriptions :column="1" bordered>
              <n-descriptions-item label="ID">
                {{ detailData.id }}
              </n-descriptions-item>
              <n-descriptions-item label="角色编码">
                {{ detailData.roleCode }}
              </n-descriptions-item>
              <n-descriptions-item label="角色名称">
                {{ detailData.roleName }}
              </n-descriptions-item>
              <n-descriptions-item label="描述">
                {{ detailData.description || '--' }}
              </n-descriptions-item>
              <n-descriptions-item label="内置角色">
                {{ detailData.isBuiltin ? '是' : '否' }}
              </n-descriptions-item>
              <n-descriptions-item label="关联用户数">
                {{ detailData.assignedUserCount }}
              </n-descriptions-item>
              <n-descriptions-item label="更新时间">
                {{ detailData.updatedAt }}
              </n-descriptions-item>
            </n-descriptions>

            <n-card size="small" class="mt-3" title="权限明细">
              <n-data-table
                :columns="[
                  { title: '模块', key: 'moduleCode' },
                  { title: '可读', key: 'canRead', render: (row: RolePermissionItem) => row.canRead ? '是' : '否' },
                  { title: '可写', key: 'canWrite', render: (row: RolePermissionItem) => row.canWrite ? '是' : '否' },
                ]"
                :data="detailData.permissions"
                :row-key="(row: RolePermissionItem) => row.moduleCode"
              />
            </n-card>
          </template>
        </n-spin>
      </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="editVisible" preset="card" :title="editMode === 'create' ? '新增角色' : '编辑角色'" class="w-760px max-w-96vw">
      <n-form label-placement="left" label-width="100">
        <n-grid :cols="24" :x-gap="16">
          <n-grid-item :span="24" :l-span="12">
            <n-form-item label="角色编码">
              <n-input v-model:value="editForm.roleCode" :disabled="editMode === 'edit' && editForm.roleCode === 'admin'" placeholder="如 custom_admin" />
            </n-form-item>
          </n-grid-item>
          <n-grid-item :span="24" :l-span="12">
            <n-form-item label="角色名称">
              <n-input v-model:value="editForm.roleName" placeholder="请输入角色名称" />
            </n-form-item>
          </n-grid-item>
        </n-grid>
        <n-form-item label="描述">
          <n-input v-model:value="editForm.description" placeholder="可选" />
        </n-form-item>
      </n-form>

      <n-card size="small" title="权限编辑">
        <n-data-table
          :columns="[
            { title: '模块', key: 'label' },
            {
              title: '可读',
              key: 'canRead',
              render: (row: PermissionEditorRow) =>
                h(NSwitch, {
                  'value': row.canRead,
                  'onUpdate:value': (value: boolean) => updateReadPermission(row.moduleCode, value),
                }),
            },
            {
              title: '可写',
              key: 'canWrite',
              render: (row: PermissionEditorRow) =>
                h(NSwitch, {
                  'value': row.canWrite,
                  'onUpdate:value': (value: boolean) => updateWritePermission(row.moduleCode, value),
                }),
            },
          ]"
          :data="permissionRows"
          :row-key="(row: PermissionEditorRow) => row.moduleCode"
        />
      </n-card>

      <template #footer>
        <n-space justify="end">
          <n-button @click="editVisible = false">
            取消
          </n-button>
          <n-button type="primary" :loading="submitting" @click="submitEdit">
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-space>
</template>
