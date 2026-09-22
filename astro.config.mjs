// astro.config.mjs —— 静态多页输出；base 由环境变量提供，默认根路径
import { defineConfig } from 'astro/config'

import { getThemeBootstrapScriptCode } from './scripts/build-theme-bootstrap.ts'

const siteBase = process.env.SITE_BASE ?? '/'

/**
 * 把首帧主题引导脚本内联进每个页面的 <head>。
 * 脚本是同步内联脚本，在首次绘制前执行，因此不会出现浅色闪一下再变深色。
 * 生成的文本同时落在 .generated/theme-bootstrap/，供第四阶段 S4-T10 计算 CSP hash。
 */
function themeBootstrapIntegration() {
  return {
    name: 'theme-bootstrap',
    hooks: {
      'astro:config:setup': async ({ injectScript }) => {
        injectScript('head-inline', await getThemeBootstrapScriptCode(siteBase))
      },
    },
  }
}

export default defineConfig({
  output: 'static',
  base: siteBase,
  // 规格第 2 节要求统一尾斜杠规则
  trailingSlash: 'always',
  outDir: './dist',
  build: { format: 'directory' },
  integrations: [themeBootstrapIntegration()],
})
