<script setup lang="ts">
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserDetail,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus,
} from '@/api/admin-users'
import { listAdminRoles } from '@/api/admin-roles'
import type { AdminUserItem, AdminUserStatus } from '@/types/admin-users'

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')
const status = ref<AdminUserStatus | null>(null)
const roleCode = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)

const rows = ref<AdminUserItem[]>([])
const selectedUserId = ref<number | null>(null)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailData = ref<AdminUserItem | null>(null)

const editVisible = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: 0,
  username: '',
  password: '',
  displayName: '',
  email: '',
  status: 'active' as AdminUserStatus,
  roleCodes: [] as string[],
})

const resetPwdVisible = ref(false)
const resetPwdForm = reactive({
  id: 0,
  username: '',
  newPassword: '',
})

const roleOptions = ref<Array<{ label: string, value: string }>>([])

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

const currentSelected = computed(() => {
  if (!selectedUserId.value)
    return null
  return rows.value.find(item => item.id === selectedUserId.value) || null
})

function getRolesText(user: AdminUserItem): string {
  if (!user.roles?.length)
    return '--'
  return user.roles.map(role => role.roleCode).join(', ')
}

function onRowClick(row: AdminUserItem) {
  selectedUserId.value = row.id
}

async function loadRolesForForm() {
  const result = await listAdminRoles({ page: 1, limit: 200 })
  roleOptions.value = result.items.map(role => ({
    label: `${role.roleName} (${role.roleCode})`,
    value: role.roleCode,
  }))
}

async function loadRows(reset = false) {
  if (reset)
    page.value = 1
  loading.value = true
  try {
    const result = await listAdminUsers({
      keyword: keyword.value.trim() || undefined,
      status: status.value || undefined,
      roleCode: roleCode.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    })
    rows.value = result.items
    total.value = result.total

    if (selectedUserId.value && !rows.value.some(item => item.id === selectedUserId.value)) {
      selectedUserId.value = null
    }
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载用户列表失败'
    window.$message.error(message)
  }
  finally {
    loading.value = false
  }
}

async function openDetail(id?: number) {
  const targetId = id || selectedUserId.value
  if (!targetId) {
    window.$message.warning('请先选择用户')
    return
  }
  detailVisible.value = true
  detailLoading.value = true
  try {
    detailData.value = await getAdminUserDetail(targetId)
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载用户详情失败'
    window.$message.error(message)
  }
  finally {
    detailLoading.value = false
  }
}

function openCreate() {
  editMode.value = 'create'
  editForm.id = 0
  editForm.username = ''
  editForm.password = ''
  editForm.displayName = ''
  editForm.email = ''
  editForm.status = 'active'
  editForm.roleCodes = ['analyst']
  editVisible.value = true
}

async function openEdit() {
  if (!selectedUserId.value) {
    window.$message.warning('请先选择用户')
    return
  }

  try {
    const detail = await getAdminUserDetail(selectedUserId.value)
    editMode.value = 'edit'
    editForm.id = detail.id
    editForm.username = detail.username
    editForm.password = ''
    editForm.displayName = detail.displayName || ''
    editForm.email = detail.email || ''
    editForm.status = detail.status
    editForm.roleCodes = detail.roles.map(role => role.roleCode)
    editVisible.value = true
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载编辑数据失败'
    window.$message.error(message)
  }
}

function validateEditForm(): string | undefined {
  if (!editForm.username.trim())
    return '用户名不能为空'
  if (editMode.value === 'create' && !editForm.password.trim())
    return '创建用户时必须填写初始密码'
  if (!editForm.roleCodes.length)
    return '至少选择一个角色'
}

async function submitEdit() {
  const validationError = validateEditForm()
  if (validationError) {
    window.$message.error(validationError)
    return
  }

  submitting.value = true
  try {
    if (editMode.value === 'create') {
      await createAdminUser({
        username: editForm.username.trim(),
        password: editForm.password,
        displayName: editForm.displayName.trim() || undefined,
        email: editForm.email.trim() || undefined,
        status: editForm.status,
        roleCodes: editForm.roleCodes,
      })
      window.$message.success('用户创建成功')
    }
    else {
      await updateAdminUser(editForm.id, {
        username: editForm.username.trim(),
        displayName: editForm.displayName.trim() || undefined,
        email: editForm.email.trim() || undefined,
        status: editForm.status,
        roleCodes: editForm.roleCodes,
      })
      window.$message.success('用户更新成功')
    }
    editVisible.value = false
    await loadRows()
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存用户失败'
    window.$message.error(message)
  }
  finally {
    submitting.value = false
  }
}

function openResetPassword() {
  if (!currentSelected.value) {
    window.$message.warning('请先选择用户')
    return
  }

  resetPwdForm.id = currentSelected.value.id
  resetPwdForm.username = currentSelected.value.username
  resetPwdForm.newPassword = ''
  resetPwdVisible.value = true
}

async function submitResetPassword() {
  if (!resetPwdForm.newPassword.trim()) {
    window.$message.error('新密码不能为空')
    return
  }
  submitting.value = true
  try {
    await resetAdminUserPassword(resetPwdForm.id, resetPwdForm.newPassword)
    window.$message.success('密码已重置')
    resetPwdVisible.value = false
  }
  catch (error: unknown) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '重置密码失败'
    window.$message.error(message)
  }
  finally {
    submitting.value = false
  }
}

function toggleUserStatus() {
  const current = currentSelected.value
  if (!current) {
    window.$message.warning('请先选择用户')
    return
  }

  const nextStatus: AdminUserStatus = current.status === 'active' ? 'disabled' : 'active'
  window.$dialog.warning({
    title: '状态变更确认',
    content: `确认将用户 ${current.username} 状态改为 ${nextStatus === 'active' ? '启用' : '禁用'} 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await updateAdminUserStatus(current.id, nextStatus)
        window.$message.success('状态更新成功')
        await loadRows()
      }
      catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '更新状态失败'
        window.$message.error(message)
      }
    },
  })
}

function removeUser() {
  const current = currentSelected.value
  if (!current) {
    window.$message.warning('请先选择用户')
    return
  }
  window.$dialog.warning({
    title: '删除确认',
    content: `确认删除用户 ${current.username} 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteAdminUser(current.id)
        window.$message.success('用户已删除')
        selectedUserId.value = null
        await loadRows()
      }
      catch (error: unknown) {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除用户失败'
        window.$message.error(message)
      }
    },
  })
}

const columns = [
  { title: 'ID', key: 'id' },
  { title: '用户名', key: 'username' },
  {
    title: '显示名',
    key: 'displayName',
    render: (row: AdminUserItem) => row.displayName || '--',
  },
  {
    title: '邮箱',
    key: 'email',
    render: (row: AdminUserItem) => row.email || '--',
  },
  {
    title: '角色',
    key: 'roles',
    render: (row: AdminUserItem) => getRolesText(row),
  },
  { title: '状态', key: 'status' },
  {
    title: '最后登录',
    key: 'lastLoginAt',
    render: (row: AdminUserItem) => row.lastLoginAt || '--',
  },
  { title: '创建时间', key: 'createdAt' },
]

onMounted(async () => {
  try {
    await loadRolesForForm()
  }
  catch {
    window.$message.warning('角色选项加载失败，创建用户时可能无法选择角色')
  }
  await loadRows(true)
})
</script>

<template>
  <n-space vertical :size="16">
    <n-card title="用户管理" size="small">
      <n-space align="center" :wrap="true">
        <n-input v-model:value="keyword" clearable placeholder="关键字（用户名/显示名/邮箱）" style="width: 260px" />
        <n-select v-model:value="status" clearable :options="statusOptions" style="width: 160px" />
        <n-input v-model:value="roleCode" clearable placeholder="角色编码（如 analyst）" style="width: 220px" />
        <n-button :loading="loading" @click="() => loadRows(true)">
          查询
        </n-button>
      </n-space>
      <n-space class="mt-3" align="center" :wrap="true">
        <n-button type="primary" @click="openCreate">
          新增用户
        </n-button>
        <n-button :disabled="!currentSelected" @click="openEdit">
          编辑
        </n-button>
        <n-button :disabled="!currentSelected" @click="toggleUserStatus">
          {{ currentSelected?.status === 'active' ? '禁用' : '启用' }}
        </n-button>
        <n-button :disabled="!currentSelected" @click="openResetPassword">
          重置密码
        </n-button>
        <n-button :disabled="!currentSelected" @click="() => openDetail()">
          查看详情
        </n-button>
        <n-button type="error" :disabled="!currentSelected" @click="removeUser">
          删除
        </n-button>
      </n-space>
    </n-card>

    <n-card size="small">
      <n-data-table
        :loading="loading"
        :columns="columns"
        :data="rows"
        :row-key="(row: AdminUserItem) => row.id"
        :row-props="(row: AdminUserItem) => ({ style: 'cursor:pointer', onClick: () => onRowClick(row) })"
      />
      <n-pagination
        class="mt-3"
        :page="page"
        :item-count="total"
        :page-size="limit"
        @update:page="(value) => { page = value; loadRows(); }"
      />
    </n-card>

    <n-drawer v-model:show="detailVisible" :width="520">
      <n-drawer-content title="用户详情" closable>
        <n-spin :show="detailLoading">
          <n-descriptions v-if="detailData" :column="1" bordered>
            <n-descriptions-item label="ID">
              {{ detailData.id }}
            </n-descriptions-item>
            <n-descriptions-item label="用户名">
              {{ detailData.username }}
            </n-descriptions-item>
            <n-descriptions-item label="显示名">
              {{ detailData.displayName || '--' }}
            </n-descriptions-item>
            <n-descriptions-item label="邮箱">
              {{ detailData.email || '--' }}
            </n-descriptions-item>
            <n-descriptions-item label="状态">
              {{ detailData.status }}
            </n-descriptions-item>
            <n-descriptions-item label="角色">
              {{ getRolesText(detailData) }}
            </n-descriptions-item>
            <n-descriptions-item label="创建时间">
              {{ detailData.createdAt }}
            </n-descriptions-item>
            <n-descriptions-item label="更新时间">
              {{ detailData.updatedAt }}
            </n-descriptions-item>
            <n-descriptions-item label="最后登录">
              {{ detailData.lastLoginAt || '--' }}
            </n-descriptions-item>
          </n-descriptions>
        </n-spin>
      </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="editVisible" preset="card" :title="editMode === 'create' ? '新增用户' : '编辑用户'" class="w-560px max-w-90vw">
      <n-form label-placement="left" label-width="100">
        <n-form-item label="用户名">
          <n-input v-model:value="editForm.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item v-if="editMode === 'create'" label="初始密码">
          <n-input v-model:value="editForm.password" type="password" show-password-on="click" placeholder="请输入初始密码" />
        </n-form-item>
        <n-form-item label="显示名">
          <n-input v-model:value="editForm.displayName" placeholder="可选" />
        </n-form-item>
        <n-form-item label="邮箱">
          <n-input v-model:value="editForm.email" placeholder="可选" />
        </n-form-item>
        <n-form-item label="状态">
          <n-select
            v-model:value="editForm.status"
            :options="[
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ]"
          />
        </n-form-item>
        <n-form-item label="角色">
          <n-select v-model:value="editForm.roleCodes" multiple :options="roleOptions" placeholder="至少选择一个角色" />
        </n-form-item>
      </n-form>

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

    <n-modal v-model:show="resetPwdVisible" preset="card" title="重置用户密码" class="w-420px max-w-90vw">
      <n-form label-placement="left" label-width="90">
        <n-form-item label="用户名">
          <n-input :value="resetPwdForm.username" disabled />
        </n-form-item>
        <n-form-item label="新密码">
          <n-input v-model:value="resetPwdForm.newPassword" type="password" show-password-on="click" placeholder="请输入新密码" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="resetPwdVisible = false">
            取消
          </n-button>
          <n-button type="primary" :loading="submitting" @click="submitResetPassword">
            提交
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-space>
</template>
