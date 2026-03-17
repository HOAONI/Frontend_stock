/** ECharts 组合式函数，负责按需注册图表组件并管理实例生命周期。 */
// 系列类型的定义后缀都为 SeriesOption。
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
} from 'echarts/charts'
// 组件类型的定义后缀都为 ComponentOption。
import type {
  DatasetComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  ToolboxComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { BarChart, CandlestickChart, LineChart, PieChart, RadarChart } from 'echarts/charts'

import {
  DatasetComponent, // 数据集组件
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent, // 内置数据转换器组件（如过滤、排序）。
} from 'echarts/components'
import * as echarts from 'echarts/core'

import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTemplateRef } from 'vue'

// 通过 ComposeOption 组合出当前项目真正会用到的图表配置类型。
export type ECOption = echarts.ComposeOption<
  | BarSeriesOption
  | CandlestickSeriesOption
  | PieSeriesOption
  | LineSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | DatasetComponentOption
  | ToolboxComponentOption
  | RadarSeriesOption
>

// 只注册项目实际会用到的图表与组件，减少打包体积。
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  TransformComponent,
  BarChart,
  PieChart,
  LineChart,
  CandlestickChart,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
  ToolboxComponent,
  RadarChart,
])

/**
 * ECharts 图表组合式函数。
 * 使用前如果引入了新的图表类型或组件，需要先在本文件顶部完成注册。
 */
export function useEcharts(ref: string, chartOptions: Ref<ECOption>) {
  const el = useTemplateRef<HTMLLIElement>(ref)

  let chart: echarts.ECharts | null = null
  let initializing = false

  const { width, height } = useElementSize(el)

  const isRendered = () => Boolean(el.value && chart)

  const hasValidSize = () => Number(width.value) > 0 && Number(height.value) > 0

  async function initIfNeeded() {
    if (chart || initializing)
      return
    if (!el.value || !hasValidSize())
      return

    initializing = true
    try {
      await nextTick()
      if (chart || !el.value || !hasValidSize())
        return

      chart = echarts.init(el.value, 'light')
      // 背景始终保持透明，避免和卡片容器的底色策略冲突。
      chart.setOption({ backgroundColor: 'transparent', ...chartOptions.value })
    }
    finally {
      initializing = false
    }
  }

  async function update(updateOptions: ECOption) {
    if (!chart)
      await initIfNeeded()
    if (isRendered())
      chart!.setOption({ backgroundColor: 'transparent', ...updateOptions })
  }

  function destroy() {
    chart?.dispose()
    chart = null
  }

  watch([() => el.value, width, height], async ([element, newWidth, newHeight]) => {
    if (!element) {
      destroy()
      return
    }
    // 尺寸变化优先走 resize；首次拿到有效尺寸时再真正初始化图表实例。
    if (isRendered() && newWidth && newHeight)
      chart?.resize()
    else
      await initIfNeeded()
  }, { immediate: true })

  watch(chartOptions, async (newValue) => {
    await update(newValue)
  })

  onMounted(async () => {
    await initIfNeeded()
  })
  onUnmounted(() => {
    destroy()
  })

  return {
    destroy,
    update,
  }
}
