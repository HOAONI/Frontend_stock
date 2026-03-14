const { VITE_COPYRIGHT_INFO } = import.meta.env

const isMobile = useMediaQuery('(max-width: 700px)')

export const useAppStore = defineStore('app-store', {
  state: () => {
    return {
      footerText: VITE_COPYRIGHT_INFO,
      collapsed: false,
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
