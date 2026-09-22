// 虚拟模块类型声明：manifest 由 scripts/build-theme-bootstrap.ts 在构建时
// 以 serializeInline 转义后的 JSON 注入（见 manifestPlugin 的 load 钩子）。
// ambient 模块声明内不能用相对 import 语句（TS2439），改用 import() 类型。
declare module 'virtual:theme-bootstrap-manifest' {
  const manifest: import('../lib/hero-source').ThemeBootstrapManifest
  export default manifest
}
