/**
 * 生成内联主题引导脚本：以 Vite JS API（configFile: false、write: false、IIFE）
 * 打包 src/bootstrap/theme-bootstrap.ts，manifest 经 serializeInline 转义后
 * 以虚拟模块注入，产物字符串替换 index.html 的 <!--theme-bootstrap--> 标记。
 *
 * 被 vite.config.ts 的 inject-site-meta 插件在 dev 与 build 阶段调用：
 * - 不加载主项目 vite.config（configFile: false），避免 prepare-site 校验链
 *   经 transformIndexHtml 再次触发本模块形成递归；
 * - dev 采用源文件 mtime 指纹缓存：site.ts、引导入口或任一被引纯规则文件
 *   变化后自动失效重建，未变化时直接复用，避免每次页面加载都执行一次打包。
 */
import { statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import type { Plugin } from 'vite'
import { site } from '../src/content/site'
import { buildThemeManifest } from '../src/lib/hero-source'
import type { ThemeBootstrapManifest } from '../src/lib/hero-source'
import { serializeInline } from '../src/lib/serialize-inline'

const VIRTUAL_MANIFEST_ID = 'virtual:theme-bootstrap-manifest'

const HERE = dirname(fileURLToPath(import.meta.url))
const BOOTSTRAP_ENTRY = resolve(HERE, '../src/bootstrap/theme-bootstrap.ts')

/** 参与产物与 manifest 的源文件：任一变化即令 dev 缓存失效 */
const FINGERPRINT_FILES = [
  BOOTSTRAP_ENTRY,
  resolve(HERE, '../src/lib/assets.ts'),
  resolve(HERE, '../src/lib/hero-source.ts'),
  resolve(HERE, '../src/lib/serialize-inline.ts'),
  resolve(HERE, '../src/lib/theme.ts'),
  resolve(HERE, '../src/content/site.ts'),
  resolve(HERE, '../src/types/content.ts'),
]

/** 提供虚拟模块：内容为转义后的 manifest JSON，作为默认导出被打进 IIFE */
function manifestPlugin(json: string): Plugin {
  return {
    name: 'theme-bootstrap-manifest',
    resolveId(id) {
      if (id === VIRTUAL_MANIFEST_ID) return `\0${VIRTUAL_MANIFEST_ID}`
      return null
    },
    load(id) {
      if (id === `\0${VIRTUAL_MANIFEST_ID}`) return `export default ${json}`
      return null
    },
  }
}

/** 打包引导入口，返回 IIFE 代码字符串（仅内存产物，不写盘） */
async function bundleBootstrapCode(manifest: ThemeBootstrapManifest): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [manifestPlugin(serializeInline(manifest))],
    build: {
      write: false,
      // 不压缩：体量极小（约 2KB），保留转义序列原样并便于检视生成物
      minify: false,
      outDir: '.generated/theme-bootstrap',
      emptyOutDir: false,
      rollupOptions: {
        input: BOOTSTRAP_ENTRY,
        output: { format: 'iife' },
      },
    },
  })
  if (Array.isArray(result) || !('output' in result)) {
    throw new Error('引导脚本构建产物形状异常：期望单一 Rollup 输出')
  }
  const chunk = result.output[0]
  if (!('code' in chunk) || typeof chunk.code !== 'string') {
    throw new Error('引导脚本构建产物缺少代码块')
  }
  return chunk.code
}

/** 内联脚本包装：注入前校验生成代码不会提前终止 <script> 或干扰 HTML 解析 */
function toScriptTag(code: string): string {
  if (code.includes('</script') || code.includes('<!--')) {
    throw new Error('生成的引导脚本包含 </script 或 <!--，拒绝注入以免脚本提前结束')
  }
  return [
    '<script>',
    '// 由 scripts/build-theme-bootstrap.ts 生成（勿手改）：主题引导 + 唯一首屏预载',
    code,
    '</script>',
  ].join('\n')
}

interface CacheEntry {
  fingerprint: string
  scriptTag: string
}

let cache: CacheEntry | null = null

function fingerprint(base: string): string {
  const mtimes = FINGERPRINT_FILES.map((file) => {
    try {
      return statSync(file).mtimeMs
    } catch {
      return -1
    }
  })
  return `${base}|${mtimes.join('|')}`
}

/**
 * 生成（或命中缓存）注入 index.html 的引导脚本标签。
 * base 来自调用方 vite config，保证 dev/build 与实际部署 base 一致。
 */
export async function getThemeBootstrapScriptTag(base: string): Promise<string> {
  const key = fingerprint(base)
  if (cache && cache.fingerprint === key) return cache.scriptTag
  const manifest = buildThemeManifest(site.hero, base)
  const scriptTag = toScriptTag(await bundleBootstrapCode(manifest))
  cache = { fingerprint: key, scriptTag }
  return scriptTag
}
