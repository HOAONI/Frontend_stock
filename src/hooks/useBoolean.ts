/**
 * 布尔值状态组合式函数。
 * 适合处理弹窗开关、加载状态等只有真/假两种结果的场景。
 *
 * @param initValue 初始值
 */
export function useBoolean(initValue = false) {
  const bool = ref(initValue)

  function setBool(value: boolean) {
    bool.value = value
  }
  function setTrue() {
    setBool(true)
  }
  function setFalse() {
    setBool(false)
  }
  function toggle() {
    setBool(!bool.value)
  }

  return {
    bool,
    setBool,
    setTrue,
    setFalse,
    toggle,
  }
}
