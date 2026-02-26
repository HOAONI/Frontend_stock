/// <reference path="../global.d.ts"/>

/* 角色数据库表字段 */
namespace Entity {
  type RoleType = 'super_admin' | 'analyst' | 'operator' | 'super' | 'admin' | 'user'

  interface Role {
    /** 用户id */
    id?: number
    /** 用户名 */
    role?: RoleType
  }
}
