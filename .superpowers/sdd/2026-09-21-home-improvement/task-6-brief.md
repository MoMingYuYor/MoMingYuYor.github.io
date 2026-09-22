# Task 6 Brief：统一主题引导和首屏预载

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第四阶段的核心构建链任务。

## 需求原文（技术方案 6.1 + 实施计划 T6，逐条落实）

### 背景问题

R06：系统浅色、保存深色偏好时首屏两张图均下载 → 改造目标：初次访问仅预载有效主题与视口对应的资源。

### 技术方案 6.1 主题引导与正确预载

保留 `personal-home:theme`、三态偏好和当前 `useTheme` API。`src/lib/theme.ts` 继续承载纯规则；新增浏览器引导入口 `src/bootstrap/theme-bootstrap.ts`，引用同一规则与资源解析函数。通过当前项目的 Vite 构建能力生成最小内联脚本，不用 `Function.toString()` 拼接依赖闭包，也不保留另一套手写判定。

构建流程生成仅含首屏图、移动图、候选资源与 base 的 manifest。注入 JSON 必须转义 `<`、`>`、`&`、U+2028、U+2029，避免脚本提前结束；禁止把完整个人数据或凭证注入引导。脚本在应用和样式生效前确定主题、设置根节点属性，再为有效主题创建一条 `rel="preload" as="image"`。移除当前仅按系统主题选择的两条静态 preload。

选择图片使用与 Hero 相同的断点，明确为小于 640px 选择 `mobileSrc`，缺省用 `src`。远程 HTTPS 地址原样使用，本地 key 经 base 解析；禁止把 `/` 拼到 `https://` 前。若使用候选图，则 preload 的 `imagesrcset/imagesizes` 与实际 picture 完全相同。后续主题切换由 Hero 请求对应新图，允许必要下载；"只下载一张"的验收仅针对未主动切换的首次加载。跨断点时浏览器选择新的合适资源是正常行为。

启动代码、manifest 与应用必须在同一次 dev/build 准备流程中生成，不能依赖旧 `.generated` 文件。保持原模板注入标记的失败检查；构建脚本避免再触发自身形成递归。脚本不可用时仍提供系统主题 CSS 与无脚本说明。新增 CSP 时应为固定内联脚本生成 hash，而不是开放任意内联脚本。

### 实施计划 T6

输入：现有 `readStoredPreference`、`resolveTheme`、`joinAssetKey` 与首屏数据。输出：同源规则的内联引导、唯一正确的首屏 preload、Hero 共享的资源选择函数。

- 写系统浅色＋保存深色的请求记录测试，确认当前初访下载两张壁纸（测试先行，存 RED 证据）。
- 在 `src/lib/hero-source.ts` 定义 `selectHeroAsset(hero, theme, narrow)`，输出选定资源与本地/远程路径，单测覆盖宽窄和缺少 mobileSrc。
- 新建 bootstrap 入口导入现有纯规则，生成脚本只设置主题、选择资源并插入 preload，不引入 Vue。
- `scripts/build-theme-bootstrap.ts` 使用 Vite JS API、`configFile: false`、`write: false`、IIFE 模式构建这个入口；避免加载主项目插件导致递归。dev 与 build 准备阶段都生成，删除静态系统主题 preload 和重复手写主题规则。
- 将 manifest 安全注入模板，浏览器使用 `joinAssetKey` 规则构造 URL；Hero 请求完全相同资源。比较实际请求而不仅比较 DOM。

注入数据最小安全序列化：

```ts
export function serializeInline(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
```

`value` 在调用点保证为已校验 manifest 对象。单测包含 `</script>` 和 Unicode 分隔符；不把用户文案直接嵌入脚本字符串。无 matchMedia、存储读取抛错时仍安全降级。

请求验证核心：

```ts
const requested: string[] = []
page.on('request', r => {
  if (/hero-(light|dark)\.webp/.test(r.url())) requested.push(r.url())
})
await page.addInitScript(() => localStorage.setItem('personal-home:theme', 'dark'))
await page.emulateMedia({ colorScheme: 'light' })
await page.goto('/', { waitUntil: 'networkidle' })
expect(requested.some(url => url.includes('hero-light.webp'))).toBe(false)
expect(requested.some(url => url.includes('hero-dark.webp'))).toBe(true)
```

运行：相关纯函数单测与 `npm run test:e2e -- tests/e2e/preload.spec.ts`。扩展至反向主题、system、宽窄资源、HTTPS 与子路径。通过依据为 A07、A08、A09。

## 当前代码事实

- `src/lib/theme.ts`：纯函数 `readStoredPreference`、`resolveTheme(preference, systemIsDark)` 等（tests/unit/theme.test.ts 12 项覆盖）。
- `src/lib/assets.ts`：`assetUrl(path, base)`（运行时读 import.meta.env.BASE_URL）、`isSafeAssetPath`；**先读它，bootstrap 里需要的 joinAssetKey 逻辑以它为准抽取/复用**——若 bootstrap 无法直接 import（含 import.meta.env），抽一个纯的 `joinAssetKey(key, base)` 供两侧共用（放 assets.ts，同步更新 assetUrl 内部使用；gallery.test/assets.test 既有用例不得削弱）。
- `index.html`：head 内联引导脚本（手写 KEY/VALID/枚举/matchMedia 逻辑）、`<!--site-meta-->` 与 `<!--noscript-contact-->` 注入标记、`</head>` 前有 `renderHeroPreload` 注入的两条静态 preload。
- `vite.config.ts`：`inject-site-meta` 插件（configResolved 记 base + transformIndexHtml 注入 meta/noscript/preload）。renderHeroPreload 来自 scripts/prepare-site.ts——T6 要**移除静态两条 preload**，改为构建时把生成的 bootstrap 内联脚本（含 manifest 与动态 preload 逻辑）注入 `</head>` 前（或替换内联主题脚本位置）。
- `scripts/prepare-site.ts`：escapeHtml、buildSiteMeta、renderMetaTags、renderNoscriptContact、renderHeroPreload、ensureSiteMeta（校验关口 + persistMetaFile）。tests/unit/content.test.ts 有 14 项覆盖其中校验逻辑——保持通过。
- Hero.vue：watch effectiveTheme 预载换图 + 竞态 token + 失败回退（保留这套运行时逻辑）；初始 `committed` 用 `heroAssets[theme]`；`isNarrow = useMediaQuery(QUERY_NARROW)`（640px 断点）。selectHeroAsset 抽出后 Hero 初始与 watch 都应使用它（同断点同选择）。
- 跑 e2e 前确认 4173 端口无残留进程。

## 实现要点与约束

- build-theme-bootstrap.ts 用 `import { build } from 'vite'`（或 createServer）以 `configFile: false`、`build.write: false`、`build.rollupOptions.format/输出 IIFE`（或 lib 模式 iife）构建 `src/bootstrap/theme-bootstrap.ts`，拿内存产物字符串。**入口 entry 不经主项目 vite.config 的插件链**（避免 prepare-site 递归触发自身）。
- 生成物注入 dev 与 build：在 inject-site-meta 插件的 transformIndexHtml 里替换 index.html 的内联主题脚本（`<script>...(function(){...})();</script>` 整段）为生成的小脚本 + manifest。注入失败（如标记缺失）保留现有 throw 语义。dev 模式每次请求重新生成或缓存失效策略要正确（内容变化后 manifest 更新）——简单起见 dev 每次生成亦可，报告说明。
- manifest 内容：`{ base, hero: { light: { src|href, mobileSrc? }, dark: {...} } }`，经 serializeInline 嵌入。bootstrap 运行时：读偏好（try/catch）→ resolveTheme → data-theme + color-scheme → selectHeroAsset(hero, theme, narrow=matchMedia('(max-width: 639.9px)')) → 创建一条 preload（href 按远程/本地规则，本地用 joinAssetKey(key, base)）。
- Hero 与 bootstrap 的断点一致：都按"小于 640px 用 mobileSrc"（QUERY_NARROW 是 639.98 或 640——以 useMediaQuery.ts 实际值为准，两侧对齐）。
- preload.spec.ts 用请求验证核心那段模式，扩展：反向组合（系统暗+存浅）、system 偏好、窄视口（mobileSrc 存在时预载 mobile 图——当前内容无 mobileSrc，用 setContent/路由拦截或临时 mock 验证单测层面即可，e2e 层面可注明当前数据无 mobileSrc 仅验证 src 路径）、宽视口。
- 单测：serializeInline（</script>、U+2028/2029、&）、selectHeroAsset（宽/窄/缺 mobileSrc/远程 https 不拼 /）、joinAssetKey（子路径 base、https key 不拼前缀）。
- 禁止派发任何子代理；你不碰：GallerySection.vue、tokens.css、global.css、main.ts、tools/**、assets/fonts-source/**（T3/T7 正在并行改各自文件）。Hero.vue 此刻无人在改（T3 可能已改完或接近完成——**动手前先读 Hero.vue 最新版**，若发现正在被修改的迹象（文件内容与描述不符）等 2 分钟重读）。
- 完成后跑：npm run typecheck、npm run test:unit（全部）、npm run build、npm run test:e2e 全量（home.spec/navigation.spec/section-spy 若已存在都要过）。

## 交付与报告契约

- 修改：src/lib/theme.ts（如需）、src/lib/assets.ts（joinAssetKey）、src/components/Hero.vue、index.html、vite.config.ts、scripts/prepare-site.ts；新增：src/bootstrap/theme-bootstrap.ts、scripts/build-theme-bootstrap.ts、src/lib/hero-source.ts、tests/e2e/preload.spec.ts、相关单测（放 tests/unit/ 合适文件）。
- 测试先行：先写 preload.spec.ts 的"系统浅色+保存深色下载两张"用例并在当前实现确认失败（存 .generated/t6-red-output.txt），再实现。
- 完整报告写入 task-6-report.md：改动文件、生成链路说明（build-theme-bootstrap 如何被 dev/build 调用、产物形状）、每个验收点（A07/A08/A09 相关）验证方式与结果、测试输出、遗留。
- 最终回复：状态 / 改动文件 / 一行测试结论 / 关注点。
