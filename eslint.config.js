/** ESLint 配置文件，统一定义项目的 TypeScript 与 Vue 代码规范。 */
import antfu from '@antfu/eslint-config'

// 官方文档：https://github.com/antfu/eslint-config
export default antfu(
  {
    typescript: {
      overrides: {
        'perfectionist/sort-exports': 'off',
        'perfectionist/sort-imports': 'off',
        'ts/no-unused-expressions': ['error', { allowShortCircuit: true }],
      },
    },
    vue: {
      overrides: {
        'vue/no-unused-refs': 'off', // 暂时关闭，等待vue-lint的分支合并
        'vue/no-reserved-component-names': 'off',
        'vue/component-definition-name-casing': 'off',
      },
    },
  },
)
