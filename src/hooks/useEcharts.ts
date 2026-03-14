// 系列类型的定义后缀都为 SeriesOption
import type {
  BarSeriesOption,
  CandlestickSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
} from 'echarts/charts'
// 组件类型的定义后缀都为 ComponentOption
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
  TransformComponent, // 内置数据转换器组件 (filter, sort)
} from 'echarts/components'
import * as echarts from 'echarts/core'

import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { useTemplateRef } from 'vue'

// 通过 ComposeOption 来组合出一个只有必须组件和图表的 Option 类型
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

// 注册必须的组件
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
 * Echarts hooks函数
 * @description 按需引入图表组件，没注册的组件需要先引入
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
