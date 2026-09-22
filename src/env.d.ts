/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** 运行模式：`preview`（默认）或 `release`（正式发布） */
  readonly SITE_MODE?: string
  /** 部署子路径，例如 `/personal/`；默认根路径 */
  readonly SITE_BASE?: string
}
