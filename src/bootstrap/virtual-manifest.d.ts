/**
 * 构建期注入的虚拟模块：内容由 scripts/build-theme-bootstrap.ts 在打包时
 * 以虚拟模块提供，形如 `export default { … }` 的已转义 JSON 字面量。
 */
declare module 'virtual:theme-bootstrap-manifest' {
  import type { ThemeBootstrapManifest } from '../lib/media'

  const manifest: ThemeBootstrapManifest
  export default manifest
}
