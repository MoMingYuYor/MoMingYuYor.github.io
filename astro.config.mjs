// astro.config.mjs —— 静态多页输出；base 由环境变量提供，默认根路径
import { defineConfig } from 'astro/config'

const siteBase = process.env.SITE_BASE ?? '/'

export default defineConfig({
  output: 'static',
  base: siteBase,
  // 规格第 2 节要求统一尾斜杠规则
  trailingSlash: 'always',
  outDir: './dist',
  build: { format: 'directory' },
})
