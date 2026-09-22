# Task 6 报告：统一主题引导和首屏预载

日期：2026-09-21　|　状态：完成（全部验证通过）

## 改动文件

新增：

| 文件 | 职责 |
| --- | --- |
| `src/lib/serialize-inline.ts` | 注入内联脚本的数据最小安全序列化：转义 `<`、`>`、`&`、U+2028、U+2029（与方案 6.1 给定实现一致） |
| `src/lib/hero-source.ts` | 共享资源选择规则：`selectHeroAsset(hero, theme, narrow)`（泛型，同时接受完整 ImageAsset 与 manifest 条目）、`HERO_NARROW_QUERY`、`buildThemeManifest`、`toManifestEntry`、manifest 类型 |
| `src/bootstrap/theme-bootstrap.ts` | 浏览器引导入口：不引入 Vue，导入 `readStoredPreference`/`resolveTheme`/`joinAssetKey`/`selectHeroAsset` 同源规则；读偏好（try/catch 降级）→ 设置 `data-theme`/`color-scheme` → 按断点选定唯一首屏资源 → 创建一条 `rel="preload" as="image"`；候选图存在时输出 `imagesrcset`/`imagesizes` |
| `src/bootstrap/virtual-manifest.d.ts` | 虚拟模块 `virtual:theme-bootstrap-manifest` 的类型声明（ambient 模块内用 `import()` 类型引用 `ThemeBootstrapManifest`，规避 TS2439） |
| `scripts/build-theme-bootstrap.ts` | 生成器：Vite JS API（`configFile: false`、`build.write: false`、`minify: false`、rollup `format: iife`）打包引导入口；manifest 经 `serializeInline` 注入虚拟模块；`</script`/`<!--` 注入前守卫；dev 用源文件 mtime 指纹缓存 |
| `tests/e2e/preload.spec.ts` | 请求级验收：4 个用例（核心 RED 用例、反向组合、system、窄视口） |
| `tests/unit/serialize-inline.test.ts` | `</script>`、`<>&`、U+2028/2029、JSON 无损还原、作为 JS 表达式求值等价 |
| `tests/unit/hero-source.test.ts` | 宽/窄/缺 mobileSrc/远程 https 不拼 `/`/manifest 条目与 ImageAsset 同规则；`HERO_NARROW_QUERY === QUERY_NARROW` 断点守卫；manifest 最小化与子路径解析 |
| `tests/unit/theme-bootstrap.test.ts` | 真实生成链产物断言：脚本形状、`</script` 恰好一次、无旧手写规则、无静态 preload、子路径 base 携带 |

修改：

| 文件 | 改动 |
| --- | --- |
| `index.html` | 删除手写内联主题脚本（KEY/VALID/matchMedia 整段），原位替换为 `<!--theme-bootstrap-->` 标记 |
| `vite.config.ts` | `transformIndexHtml` 改 async：新增 `<!--theme-bootstrap-->` 标记缺失检查（保留 throw 语义），以 `getThemeBootstrapScriptTag(resolvedBase)` 注入生成脚本；移除 `renderHeroPreload` 静态注入 |
| `scripts/prepare-site.ts` | 删除 `renderHeroPreload`（两条按系统主题的静态 preload 来源） |
| `src/components/Hero.vue` | 初始提交与 watch 换图均改用 `selectHeroAsset`（同断点同选择）；**保留竞态 token、pending/failed 回退语义不变**；`CommittedHero` 由 `SelectedHeroAsset<ImageAsset>` 取代 |
| `src/lib/theme.ts` | 仅更新 `THEME_STORAGE_KEY` 注释（引导脚本现在直接 import 同一常量，一致性由结构保证） |
| `tests/unit/assets.test.ts` | 增补 1 例：子路径 base 下 https 键不拼前缀（既有用例全部保留，未削弱） |

未触碰（遵守禁令）：Header.vue、App.vue、GallerySection.vue、tokens.css、global.css、main.ts、tests/components/**、tools/**、assets/fonts-source/**、src/styles/**。`src/lib/assets.ts` 未改——`joinAssetKey(base, path)` 已是纯函数且被 `assetUrl` 内部复用，bootstrap 直接 import 即可，无需抽取。

## 生成链路说明

```
vite dev / vite build
  └─ vite.config.ts [inject-site-meta] configResolved → resolvedBase
       └─ transformIndexHtml (async)
            ├─ 校验 <!--site-meta--> / <!--noscript-contact--> / <!--theme-bootstrap--> 标记（缺失即 throw）
            └─ scripts/build-theme-bootstrap.ts → getThemeBootstrapScriptTag(base)
                 ├─ buildThemeManifest(site.hero, base)          # 仅 base + 两主题 {src, mobileSrc?, candidates?, sizes?}，不含 alt/文案/凭证
                 ├─ serializeInline(manifest) → 虚拟模块 load    # 转义 <、>、&、U+2028、U+2029
                 ├─ vite build({configFile:false, write:false, minify:false, rollupOptions.output.format:'iife'})
                 │    # 入口 src/bootstrap/theme-bootstrap.ts 不经主项目插件链 → 无递归
                 ├─ toScriptTag：检查产物不含 </script、<!--，包装为 <script>…</script>
                 └─ 模块级 mtime 指纹缓存（base + 引导入口/纯规则/site/types 共 7 个文件的 mtime）
                      # dev 未变化直接复用；site.ts 或任一规则文件变化自动失效重建（报告选择：缓存而非每次生成，避免每次页面加载都打包一次）
```

产物形状（dist/index.html 已检视）：`<script>` 内为自执行 IIFE + `var _virtual_theme_bootstrap_manifest_default = { "base": "/", "hero": { "light": {…}, "dark": {…} } }`；运行时按 同一存储键 → resolveTheme → `data-theme`/`color-scheme` → `joinAssetKey(base, selected.key)` → 单条 preload。`npm run build` 与 `npm run dev` 走同一条链，无旧 `.generated` 依赖。

## 验收点验证（A07/A08/A09）

**RED 证据（测试先行）**：`.generated/t6-red-output.txt` —— 实现前运行 preload.spec：**3 failed / 1 passed**。核心用例"系统浅色＋保存深色"失败于 `requested.some(hero-light)` 为 true：静态 preload 命中系统主题（light）+ 应用按保存偏好请求 dark → 两张壁纸都下载，即 R06 场景。

**A07 主题引导统一（同源规则、无第二套手写判定）**
- 单测：`theme.test.ts` 12 项既有契约全保留；引导脚本 import 同一 `readStoredPreference`/`resolveTheme`/`THEME_STORAGE_KEY`。
- 产物断言：`theme-bootstrap.test.ts` 验证生成物不含 `VALID.indexOf`（旧手写枚举），含 `personal-home:theme` 与 `dataset.theme`。
- index.html 手写脚本已删除；无 matchMedia、存储抛错时 try/catch 降级（tokens.css 的 `@media (prefers-color-scheme: dark) :root:not([data-theme])` 兜底仍在，noscript 说明未动）。

**A08 初访仅请求有效主题资源（比较实际请求而非 DOM）**
- `tests/e2e/preload.spec.ts` 用 `page.on('request')` 捕获 hero-*.webp 请求：核心组合（系统浅色+存深色）断言 light 未请求、dark 已请求、去重后恰好 `['hero-dark.webp']`；扩展反向组合（系统暗+存浅）、system 偏好、窄视口。实现后 **4/4 通过**。
- 全量 e2e **34/34 通过**（home 5 + navigation + visual 10 + section-spy（T5 已落地）+ preload 4），含既有双主题截图与导航用例，证明运行时换图、持久化、无闪色行为未被破坏。
- Hero 侧保留竞态 token 与失败回退；后续手动切换主题由 Hero 按需请求新图（"只下载一张"仅约束未主动切换的首次加载）。

**A09 生成链与 manifest 安全注入**
- dev/build 同链路：`npm run build` 产物检视——静态 preload 为 0 条、生成脚本含 `"base": "/"` 与两主题资源键；dev 冒烟（vite --port 5173 + curl）注入同样生效且无静态 preload。
- 注入安全：`serializeInline` 单测覆盖 `</script>`、`&`、U+2028/2029 且 JSON.parse 可无损还原、作为 JS 表达式求值等价；生成器对最终产物做 `</script`/`<!--` 守卫；manifest 只含 base + 资源键（单测断言不含 alt/尺寸等个人数据）。
- 远程/本地规则：`joinAssetKey` 单测（含增补的子路径+https 组合）保证 https 原样、本地键拼 base、不安全路径抛错（引导侧抛错被外层 try/catch 捕获，仅少一条预载）。
- 子路径 base：`npx vite build --base=/personal/`（MSYS_NO_PATHCONV=1）产物含 `"base": "/personal/"`、静态 preload 0 条；运行时拼接由 `joinAssetKey('/personal/', …)` 单测覆盖。

## 测试输出

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `npm run typecheck` | 通过（vue-tsc + tsc 无错误） |
| 单测 | `npm run test:unit` | **10 文件 104/104 通过**（新增 3 文件 12 例 + assets 增补 1 例） |
| 构建 | `npm run build` | 通过（118ms；dist/index.html 检视符合预期） |
| e2e | `npm run test:e2e`（4173 端口已预检空闲） | **34/34 通过（8.9s）** |
| RED | `npx playwright test tests/e2e/preload.spec.ts`（实现前） | 3 failed / 1 passed，存 `.generated/t6-red-output.txt` |
| dev 冒烟 | vite dev + curl | 注入生效、无静态 preload，进程已停止 |

## 遗留与说明

1. **候选图 pairing 约束**：bootstrap 在 manifest 条目同时含 `candidates` 与 `sizes` 时输出 `imagesrcset`/`imagesizes`（与 picture 完全相同的构造规则）。当前内容源无 candidates 且 Hero picture 不渲染 srcset，故实际 preload 无 srcset——若未来内容加入 candidates，需同步让 Hero picture 渲染同构 srcset（bootstrap 侧已就绪）。
2. **窄视口 e2e 范围**：当前内容无 mobileSrc，e2e 仅能验证窄屏回退主图 src 路径（spec 内已注明）；mobileSrc 的宽窄选择逻辑由 `hero-source.test.ts` 单测覆盖。
3. **minify: false**：生成脚本约 2KB，不压缩以保留转义序列原样并便于检视；如需压缩需先验证 esbuild 不改写字符串转义。
4. **dev 缓存策略**：mtime 指纹（7 个相关源文件 + base）。改动 `src/lib`、`src/bootstrap`、`src/content/site.ts` 后 dev 自动重建；纯静态资源（public/ 图片内容替换但键不变）无需失效，符合 manifest 只含键的设计。
5. **构建警告（非本任务引入的类别）**：Vite 8 native 构建对无扩展名相对导入给出提示，`src/content/validate.ts` 既有同类导入已在列；`hero-source.ts` 的 `import type` 同类提示，类型导入会被擦除，无运行时影响。全仓库统一加 `.ts` 扩展名属独立决策，未擅动。
6. 并行任务接口：T5（Header/App/useSectionSpy/section-spy.spec）与 T7（main.ts/字体）改动与本链路无交叉；e2e 全量已包含两者的用例且通过。
