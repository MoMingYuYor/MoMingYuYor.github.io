import vue from '@vitejs/plugin-vue'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { getThemeBootstrapScriptTag } from './scripts/build-theme-bootstrap'
import { buildSiteMeta, ensureSiteMeta, escapeHtml, renderNoscriptContact } from './scripts/prepare-site'
import { site } from './src/content/site'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/**
 * 发布 base 由明确的 SITE_BASE 环境变量提供，默认 '/'（技术方案 6.3）。
 * 验证脚本 scripts/verify.ts 的子路径步骤会设置 SITE_BASE=/personal/ 构建到独立输出目录；
 * CLI 直接构建时也可用 SITE_BASE npm run build（与 --base 两种方式等效，环境变量便于整链传递）。
 */
const siteBase = process.env.SITE_BASE ?? '/'

let resolvedBase = siteBase

// 字体子集缺失时的显式指引：dev 不强制重建（文件已在源码树内），缺失通常意味着尚未执行过 fonts:build；
// build 链（check:content → fonts:build → vite build）先于本配置加载完成字体准备，不受此检查影响。
// 注意 vitest 也经由本配置启动，字体文件正常存在时该检查无感。
for (const weight of [600, 700]) {
  const fontPath = resolve(projectRoot, `src/assets/fonts/noto-serif-sc-${weight}.woff2`)
  if (!existsSync(fontPath)) {
    throw new Error(
      `缺少字体子集 src/assets/fonts/noto-serif-sc-${weight}.woff2。\n` +
        '请先运行 npm run fonts:build（需要 tools/fonts/.venv，创建方式见 README「字体子集」一节）。',
    )
  }
}

export default defineConfig({
  base: siteBase,
  plugins: [
    vue(),
    {
      name: 'inject-site-meta',
      configResolved(config) {
        resolvedBase = config.base
      },
      // 元数据与无脚本联系入口来自同一内容源；开发服务器与构建同样执行准备流程。
      // 主题引导由 scripts/build-theme-bootstrap.ts 生成后替换标记，替代
      // 旧手写内联脚本与两条按系统主题的静态 preload（R06：错配主题不再多下载一张）。
      async transformIndexHtml(html) {
        if (!html.includes('<!--site-meta-->') || !html.includes('<!--noscript-contact-->')) {
          throw new Error('index.html 缺少 site-meta 或 noscript-contact 注入标记，拒绝静默跳过内容校验')
        }
        if (!html.includes('<!--theme-bootstrap-->')) {
          throw new Error('index.html 缺少 theme-bootstrap 注入标记，拒绝静默跳过主题引导生成')
        }
        const bootstrapScript = await getThemeBootstrapScriptTag(resolvedBase)
        return html
          .replace(/<html lang="[^"]*">/, () => `<html lang="${escapeHtml(buildSiteMeta(site).lang)}">`)
          .replace('<!--site-meta-->', () => ensureSiteMeta())
          .replace('<!--noscript-contact-->', () => renderNoscriptContact(site))
          .replace('<!--theme-bootstrap-->', () => bootstrapScript)
      },
    },
  ],
  test: {
    environment: 'node',
    // 组件测试文件顶端用 // @vitest-environment happy-dom 注解声明 DOM 环境，其余保持 Node
    include: ['tests/unit/**/*.test.ts', 'tests/components/**/*.spec.ts'],
    testTimeout: 60_000,
  },
})
