/** 应用级 store，负责维护布局状态、主题偏好和全局界面开关。 */
const { VITE_COPYRIGHT_INFO } = import.meta.env

const isMobile = useMediaQuery('(max-width: 700px)')

export const useAppStore = defineStore('app-store', {
  state: () => {
    return {
      footerText: VITE_COPYRIGHT_INFO,
      collapsed: false,
      // 通过 loadFlag 触发内容区重挂载，供“刷新当前页”场景复用。
      loadFlag: true,
      showLogo: true,
      showProgress: true,
    }
  },
  getters: {
    isMobile() {
      return isMobile.value
    },
  },
  actions: {
    toggleCollapse() {
      this.collapsed = !this.collapsed
    },
    async reloadPage(delay = 600) {
      // 先临时卸载内容区，再在下一个 tick 重新挂载，达到软刷新当前页的效果。
      this.loadFlag = false
      await nextTick()
      if (delay) {
        setTimeout(() => {
          this.loadFlag = true
        }, delay)
      }
      else {
        this.loadFlag = true
      }
    },
  },
})
