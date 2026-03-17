/** 布局公共组件导出入口，方便主布局按统一路径引入头部和通用部件。 */
import BackTop from './common/BackTop.vue'
import Logo from './common/Logo.vue'
import MobileDrawer from './common/MobileDrawer.vue'

import Breadcrumb from './header/Breadcrumb.vue'
import CollapaseButton from './header/CollapaseButton.vue'
import UserCenter from './header/UserCenter.vue'

export {
  BackTop,
  Breadcrumb,
  CollapaseButton,
  Logo,
  MobileDrawer,
  UserCenter,
}
