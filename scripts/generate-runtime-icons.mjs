/** 运行时图标生成脚本，根据 vendored 图标清单产出 SVG 资源和名称映射。 */
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_PREFIX = 'icon-park-outline'
const ICON_NAMES = [
  'home',
  'analysis',
  'time',
  'chart-line',
  'file-code',
  'config',
  'personal-privacy',
  'stock-market',
  'people-safe',
  'setting-two',
  'every-user',
  'log',
  'ghost',
  'user-business',
  'setting-config',
  'logout',
]

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const iconsJsonPath = path.join(projectRoot, 'node_modules', '@iconify-json', SOURCE_PREFIX, 'icons.json')
const outputDir = path.join(projectRoot, 'src', 'assets', 'runtime-icons', SOURCE_PREFIX)
const mappingFilePath = path.join(projectRoot, 'src', 'utils', 'runtime-icon.generated.ts')

function readCollection() {
  const payload = JSON.parse(readFileSync(iconsJsonPath, 'utf8'))
  if (!payload?.icons) {
    throw new Error(`Invalid icon collection: ${iconsJsonPath}`)
  }
  return payload
}

function renderSvg(iconData, defaults) {
  const width = iconData.width ?? defaults.width ?? 16
  const height = iconData.height ?? defaults.height ?? 16
  const left = iconData.left ?? 0
  const top = iconData.top ?? 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${iconData.body}</svg>\n`
}

function writeGeneratedAssets(collection) {
  mkdirSync(outputDir, { recursive: true })

  // 先清掉不在白名单中的旧图标，避免运行时目录残留失效资源。
  const keep = new Set(ICON_NAMES)
  for (const entry of readdirSync(outputDir)) {
    if (!entry.endsWith('.svg'))
      continue
    const iconName = entry.slice(0, -4)
    if (!keep.has(iconName))
      unlinkSync(path.join(outputDir, entry))
  }

  for (const iconName of ICON_NAMES) {
    const iconData = collection.icons[iconName]
    if (!iconData) {
      throw new Error(`Missing ${SOURCE_PREFIX}:${iconName} in ${iconsJsonPath}`)
    }

    const svg = renderSvg(iconData, collection)
    writeFileSync(path.join(outputDir, `${iconName}.svg`), svg, 'utf8')
  }
}

function writeMappingFile() {
  const entries = ICON_NAMES
    .map(iconName => `  '${SOURCE_PREFIX}:${iconName}': '/src/assets/runtime-icons/${SOURCE_PREFIX}/${iconName}.svg',`)
    .join('\n')

  const contents = `// 此文件由 scripts/generate-runtime-icons.mjs 自动生成。\n// 请勿手动修改。\n\nexport const vendoredRuntimeIconPathMap = {\n${entries}\n} as const\n\nexport type VendoredRuntimeIconName = keyof typeof vendoredRuntimeIconPathMap\n`

  writeFileSync(mappingFilePath, contents, 'utf8')
}

function main() {
  const collection = readCollection()
  writeGeneratedAssets(collection)
  writeMappingFile()
  console.log(`已从 ${SOURCE_PREFIX} 生成 ${ICON_NAMES.length} 个 vendored 运行时图标。`)
}

main()
