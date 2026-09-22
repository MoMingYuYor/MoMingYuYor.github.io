/**
 * 生成首帧主题引导脚本：以 Vite JS API（`configFile: false`、`write: false`、IIFE）
 * 打包 `src/bootstrap/theme-bootstrap.ts`，清单经 serializeInline 转义后以虚拟模块注入。
 *
 * 被 astro.config.mjs 的集成在 `astro:config:setup` 阶段调用并内联进 `<head>`：
 * - 不加载主项目配置（`configFile: false`），避免与 Astro 自身的构建递归；
 * - 按源文件 mtime 指纹缓存，源未变化时复用，避免每个页面重复打包；
 * - 生成的脚本文本同时写入 `.generated/theme-bootstrap/`，供第四阶段 S4-T10
 *   计算 CSP hash 时取用同一份文本。
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import type { Plugin } from 'vite'

import { buildThemeManifest } from '../src/lib/media'
import { serializeInline } from '../src/lib/serialize-inline'
import { hero } from '../src/lib/site'

const VIRTUAL_MANIFEST_ID = 'virtual:theme-bootstrap-manifest'

const HERE = dirname(fileURLToPath(import.meta.url))
const BOOTSTRAP_ENTRY = resolve(HERE, '../src/bootstrap/theme-bootstrap.ts')
const GENERATED_DIR = resolve(HERE, '../.generated/theme-bootstrap')
const GENERATED_CODE_FILE = resolve(GENERATED_DIR, 'theme-bootstrap.js')

/** 参与产物与清单的源文件：任一变化即令缓存失效 */
const FINGERPRINT_FILES = [
  BOOTSTRAP_ENTRY,
  resolve(HERE, '../src/lib/media.ts'),
  resolve(HERE, '../src/lib/paths.ts'),
  resolve(HERE, '../src/lib/serialize-inline.ts'),
  resolve(HERE, '../src/lib/site.ts'),
  resolve(HERE, '../src/lib/theme.ts'),
]

/** 提供虚拟模块：内容为转义后的清单 JSON，作为默认导出被打进 IIFE */
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

async function bundleBootstrapCode(base: string): Promise<string> {
  const manifest = buildThemeManifest(hero, base)
  const result = await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [manifestPlugin(serializeInline(manifest))],
    build: {
      write: false,
      // 不压缩：体量极小，保留转义序列原样并便于检视生成物
      minify: false,
      outDir: GENERATED_DIR,
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
  if (!chunk || !('code' in chunk) || typeof chunk.code !== 'string') {
    throw new Error('引导脚本构建产物缺少代码块')
  }
  return chunk.code
}

/** 注入前校验：生成代码不得提前终止 `<script>` 或干扰 HTML 解析 */
function assertInjectable(code: string): void {
  if (code.includes('</script') || code.includes('<!--')) {
    throw new Error('生成的引导脚本包含 </script 或 <!--，拒绝注入以免脚本提前结束')
  }
}

interface CacheEntry {
  fingerprint: string
  code: string
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
 * 取（或按缓存复用）内联进 `<head>` 的引导脚本文本，不含 `<script>` 标签本身。
 * base 来自调用方，保证 dev 与 build 使用与实际部署一致的路径前缀。
 */
export async function getThemeBootstrapScriptCode(base: string): Promise<string> {
  const key = fingerprint(base)
  if (cache && cache.fingerprint === key) return cache.code

  const code = await bundleBootstrapCode(base)
  assertInjectable(code)
  cache = { fingerprint: key, code }

  try {
    mkdirSync(GENERATED_DIR, { recursive: true })
    writeFileSync(GENERATED_CODE_FILE, code, 'utf8')
  } catch {
    /* 取不到可写目录不影响构建；CSP hash 由第四阶段按本函数返回值处理 */
  }

  return code
}
