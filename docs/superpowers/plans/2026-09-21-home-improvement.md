# 个人主页四阶段改造实施计划

> For agentic workers：实际实施时使用 subagent-driven-development 或 executing-plans，逐任务执行并验收。当前仅交付计划，复选框不代表已完成。

Goal：在保留 A 首屏、C 画廊和深浅主题的前提下，修复手机与键盘问题，提升展示层次并加固资源加载和发布验证。

Architecture：继续使用静态 Vue 单页与统一内容配置。复用图库交互，增加表现变体；主题规则与资源解析共享；纯结构校验、文件系统检查和浏览器行为各自验证。

Tech Stack：现有 Vue 3、TypeScript、Vite、Vitest、Playwright、原生 CSS。仅按任务需要新增开发测试及字体工具，版本在执行时核定并锁定，不升级核心栈。

Spec：[体验提升与工程加固技术方案](../../04-体验提升与工程加固技术方案.md)。执行者须同时读取方案，不仅凭任务标题实现。

## 全局约束

- 文档日期 2026-09-21，当前任务只编写文档，应用改造尚未执行。
- 不虚构个人内容；演示数据可以用于开发；不增加后端、路由、自动播放或滚轮拦截。
- `personal-home:theme` 与 system/light/dark 三态不变；主题切换不得重置图库、项目详情、焦点和滚动。
- 主要断点 640/1024px，验证 320/390/768/1024/1440px，深浅模式均需完整。
- 所有文件改动以当前工作区为准，保留其他人的改动。当前目录未初始化 Git，不能假设有提交历史或直接执行 git commit。
- 初始基线是 47 项单测和 5 项 E2E 通过；新增测试不得用删除原测试换取通过。
- 字体与性能数值是验收目标，未测不得报告达标；deviceScaleFactor 不等于浏览器缩放。

## 文件与任务边界

| 任务 | 修改文件 | 新增文件 |
| --- | --- | --- |
| T1 手机导航 | `src/components/Header.vue`、`ThemeSwitch.vue` | `tests/e2e/navigation.spec.ts` |
| T2 图库边界 | `src/components/GallerySection.vue`、`vite.config.ts`、`package.json` | `tests/components/gallery.spec.ts` |
| T3 视觉精修 | `src/components/Hero.vue`、`GallerySection.vue`、`src/styles/tokens.css`、`global.css` | `tests/e2e/visual.spec.ts` |
| T4 展示层次 | `src/components/InterestGallery.vue`、`ProjectGallery.vue`、`GallerySection.vue` | `tests/components/project-details.spec.ts` |
| T5 当前章节 | `src/components/Header.vue`、`src/App.vue` | `src/composables/useSectionSpy.ts`、`tests/e2e/section-spy.spec.ts` |
| T6 主题预载 | `src/lib/theme.ts`、`assets.ts`、`src/components/Hero.vue`、`index.html`、`vite.config.ts`、`scripts/prepare-site.ts` | `src/bootstrap/theme-bootstrap.ts`、`scripts/build-theme-bootstrap.ts`、`src/lib/hero-source.ts`、`tests/e2e/preload.spec.ts` |
| T7 字体 | `src/main.ts`、`src/styles/tokens.css`、构建准备流程 | `scripts/collect-font-chars.ts`、`scripts/prepare-fonts.py`、`tools/fonts/requirements.txt`、`tests/unit/font-chars.test.ts` |
| T8 发布验证 | `scripts/prepare-site.ts`、`package.json`、`playwright.config.ts`、`vite.config.ts`、`scripts/screenshot.mjs`、`README.md` | `scripts/check-assets.ts`、`tests/unit/check-assets.test.ts`、`scripts/verify.ts`、`tests/e2e/failures.spec.ts` |

表中省略目录的并列文件沿用同单元格前面的目录。各阶段先交付可独立测试的结果，再继续后续阶段。T1/T2 可按文件并行；T3/T4 都修改图库，不并行写入。T6 与 T7 可并行探索，但构建流程接入由同一执行者串行整合。T8 汇总全部结果。

## 第一阶段

### T1：让手机导航与主题控制完整可用

输入：Header 的 `sections` 和已有 `useTheme()`。输出：父组件中的 `openPanel: 'navigation' | 'theme' | null`，主题控件通过 `open` 属性与 `update:open` 事件同步；菜单选择继续使用现有原生锚点。

- [ ] 先在新 E2E 中固定 320px，断言菜单按钮完整处于视口，再验证 Enter 打开后首个导航链接获得焦点；确认当前实现至少在该场景失败。
- [ ] 修改 Header/ThemeSwitch，按技术方案 3.1 实现互斥展开、焦点进入、Escape、外部点击、同锚点选择和断点切换。
- [ ] 在 390/768/1024px 复核，验证主题三态和已有持久化测试仍通过。

首个可直接采用的回归断言：

```ts
test('320px 菜单完整可见且打开后焦点进入导航', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '打开导航菜单' })
  const box = await trigger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('navigation').getByRole('link').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
```

运行：`npm run test:e2e -- tests/e2e/navigation.spec.ts`。通过依据为 A01、A02，不能用仅检查页面没有横向滚动替代按钮边界检查。

### T2：修正图库单项语义和图片失败

输入：已有 `items` 与 `activeId`；输出：0/1/多项对应语义、按 URL 管理的失败状态。保留多项键盘契约。

- [ ] 安装锁定的 `@vue/test-utils` 与 DOM 测试环境作为开发依赖；只让 `tests/components` 使用 DOM 环境，原纯函数测试仍用 Node。
- [ ] 为单项建立测试，断言没有 tablist、没有 tabpanel，标题和图片仍存在。多项测试检查每个 `aria-controls` 指向实际面板。
- [ ] 增加缩略图 error 事件用例；修改组件让主图和缩略图均使用稳定占位，URL 更换后能够重新加载。
- [ ] 验证删除激活项、0 项及两个章节同名条目不冲突。

条件语义的实施起点：

```vue
<div
  :role="items.length > 1 ? 'tabpanel' : undefined"
  :aria-labelledby="items.length > 1 ? tabId(item.id) : undefined"
>
  <!-- 继续使用真实标题，不以 ARIA 标签替代可见内容 -->
</div>
```

运行：`npm run test:unit -- tests/components/gallery.spec.ts tests/unit/gallery.test.ts`。须调整 Vitest include 纳入组件目录；组件测试文件顶端使用对应的环境注解。组件挂载需要的 matchMedia stub 放在该测试内，不能污染生产代码。通过依据为 A03、A12。

## 第二阶段

### T3：精修首屏与画廊可读性

输入：技术方案第 4 节视觉参数与现有双主题。输出：手机局部遮罩、紧凑日期面板、两行图库标题和五档视口截图。

- [ ] 保存改造前首屏与画廊截图，标明视口、主题和日期。
- [ ] 将手机遮罩从全域渐白改为文字组局部渐变；日期面板减少间距、不裁切文字；标题空间允许两行。
- [ ] 先完成深浅 390px，再检查 320/768/1024/1440px 及长文本，不通过整体缩小字号解决溢出。
- [ ] 新建视觉测试，固定本地日期、减少动画并等待字体与实际可见图片解码后拍摄；人工确认后建立基线。

图库标题初始样式可采用：

```css
.gallery-tab-name {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

完整标题仍在主内容区显示，不能只用 tooltip 承载唯一信息。视觉测试使用 `page.clock.setFixedTime(new Date('2026-09-21T04:00:00Z'))` 并固定 `timezoneId: 'Asia/Shanghai'`，然后 `await page.evaluate(() => document.fonts.ready)`。页面上下文启用 `reducedMotion: 'reduce'`。定位到目标章节并等待可见图片加载，避免把懒加载占位误拍成缺图。

运行：`npm run test:e2e -- tests/e2e/visual.spec.ts`。首次基线建立可以使用 Playwright 更新快照命令，但只能在人工看过效果后执行。检查 A01、A04、A11；真实 200% 浏览器缩放另记录结果。

## 第三阶段

### T4：兴趣与作品分层，加入页内详情

输入：现有 `GalleryItem/ProjectItem`，不改字段。输出：`GallerySection` 的 `variant: 'interest' | 'project'` 与原生详情展开。

- [ ] 在两个包装组件显式传入 variant；先写“兴趣不展示项目事实、作品详情默认折叠”的测试。
- [ ] 兴趣手机端改为文字主题条；作品维持精简缩略图选择器，概要与成果优先展示。
- [ ] ProjectGallery 默认保留概要、成果及访问链接，角色、时间、背景进入 details。现有列表项按 id 保留 DOM，主题不重建组件。
- [ ] 测试原生键盘展开、折叠后内部链接退出 Tab 顺序、项目切换和主题切换不错误重置展开状态。

详情结构起点：

```vue
<p class="project-outcome">{{ item.outcome }}</p>
<details class="project-details">
  <summary>项目详情</summary>
  <dl><!-- 角色、时间、背景，使用现有字段渲染 --></dl>
</details>
<!-- 访问项目、源码链接仍在 details 外部 -->
```

运行：`npm run test:unit -- tests/components/project-details.spec.ts` 并扩充 `visual.spec.ts` 的详情展开截图。通过依据为 A05。演示事实仍用现有占位，不能撰写虚构成果。

### T5：增加当前章节定位

输入：App 已有的可见 `navSections`。输出：`useSectionSpy(sectionIds: Ref<string[]>, headerOffset: Ref<number>): { activeSectionId: Ref<string> }`；Header 接收 `activeSectionId` 并渲染 `aria-current="location"`。

- [ ] 先写滚动到作品区后仅作品导航带 aria-current 的用例，确认当前实现不满足。
- [ ] 实现观察器、目标变更与卸载清理；使用技术方案定义的视口上部选择规则，不用最大面积比例导致长章节失选。
- [ ] 对大章节、页尾、缺少兴趣、直接 hash 和浏览器后退逐项验证。

Header 呈现表达式：

```vue
<a :href="`#${section.id}`"
   :aria-current="section.id === activeSectionId ? 'location' : undefined">
  {{ section.label }}
</a>
```

运行：`npm run test:e2e -- tests/e2e/section-spy.spec.ts`。测试记录滚动前后的 `location.hash` 与 `history.length`，纯滚动不应改变它们。通过依据为 A06。

## 第四阶段

### T6：统一主题引导和首屏预载

输入：现有 `readStoredPreference`、`resolveTheme`、`joinAssetKey` 与首屏数据。输出：同源规则的内联引导、唯一正确的首屏 preload、Hero 共享的资源选择函数。

- [ ] 写系统浅色＋保存深色的请求记录测试，确认当前初访下载两张壁纸。
- [ ] 在 `src/lib/hero-source.ts` 定义 `selectHeroAsset(hero, theme, narrow)`，输出选定资源与本地/远程路径，单测覆盖宽窄和缺少 mobileSrc。
- [ ] 新建 bootstrap 入口导入现有纯规则，生成脚本只设置主题、选择资源并插入 preload，不引入 Vue。
- [ ] `scripts/build-theme-bootstrap.ts` 使用 Vite JS API、`configFile: false`、`write: false`、IIFE 模式构建这个入口；避免加载主项目插件导致递归。dev 与 build 准备阶段都生成，删除静态系统主题 preload 和重复手写主题规则。
- [ ] 将 manifest 安全注入模板，浏览器使用 `joinAssetKey` 规则构造 URL；Hero 请求完全相同资源。比较实际请求而不仅比较 DOM。

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

### T7：字体裁剪先验证后接入

输入：本地字体源、OFL 许可、内容与固定文案。输出：字符清单、600/700 子集 WOFF2、生成 CSS 和可复现体积记录。

- [ ] 先记录现有所有章节浏览的字体请求数、传输字节与截图；不把磁盘包大小当下载量。
- [ ] 验证当前包是否提供可裁剪的完整字体源；若只有分片，明确所需字体源及许可后再接入，禁止盲目合并不兼容的字体表。
- [ ] 在项目隔离 Python 环境核定 fontTools 与 Brotli，记录精确版本；这一步仅在实际执行本任务时进行。
- [ ] 收集 site 所有可显示文本、组件固定标签、日期/星期/问候和标点；单测覆盖非激活项目和详情文本。字体 cmap 校验不得静默忽略缺失字符。
- [ ] 生成两个字重子集并保留必要字体布局和许可元信息；替换 `main.ts` 的整套分片 CSS 导入，接入内容变更重建。
- [ ] 按相同冷缓存、相同浏览流程对比资源与视觉；不达预算如实记录，不删内容或降画质凑数字。

字体源准备完成后，将两个已核验静态字重文件分别归档为 `assets/fonts-source/NotoSerifSC-600.ttf` 与 `assets/fonts-source/NotoSerifSC-700.ttf`，同目录保存许可与来源记录；当前这些文件尚不存在。若拿到的是可变字体，先显式生成对应 weight 的静态实例，不能仅重命名冒充静态字体。脚本创建 `.generated/fonts/` 和字符清单后，在项目隔离 Python 环境执行：

```sh
python -m fontTools.subset assets/fonts-source/NotoSerifSC-600.ttf --text-file=.generated/font-chars.txt --flavor=woff2 --no-ignore-missing-unicodes --output-file=.generated/fonts/noto-serif-sc-600.woff2
python -m fontTools.subset assets/fonts-source/NotoSerifSC-700.ttf --text-file=.generated/font-chars.txt --flavor=woff2 --no-ignore-missing-unicodes --output-file=.generated/fonts/noto-serif-sc-700.woff2
```

emoji 等刻意由系统字体呈现的符号放入明确的回退清单，不传入衬线字体子集；正常中文字符不允许悄悄从清单中删除。生成 CSS 通过 Vite 管理资源引用，使 hash 和 base 正确。

运行：`tests/unit/font-chars.test.ts`、普通构建及字体网络检查。通过依据为 A10；体积预算是较 494KB 基线降低至少 40%，同时完整覆盖现有文本。字体源或环境不满足时，只阻塞本任务，其他阶段仍可交付。

### T8：构建拦截与发布验证入口

输入：内容源、实际 public 目录、SITE_BASE 和前述测试。输出：严格资源检查、`verify` 命令、移动/异常回归与发布记录。

- [ ] 在临时测试目录构造“缺图”“文件路径指向目录”“越界”“合法资源”“HTTPS”五类输入，先写失败用例。
- [ ] 实现 `checkLocalAssets(content, publicRoot)`，返回带字段路径的问题数组；用 `realpath` 检查符号链接目标也不能逃离根目录，非HTTPS本地项必须实际存在。
- [ ] 将检查接入 `ensureSiteMeta`，`SITE_BASE` 接入 Vite base；移除截图脚本把像素密度称为 200% 缩放的说明。
- [ ] 新增 `scripts/verify.ts` 串行执行检查，任一步失败即非零退出；单测进程初始限时 60 秒，超时实际终止进程树。普通构建与子路径构建不得并发写 dist。
- [ ] Playwright 增加窄屏和失败场景，CI 使用本次构建的新服务；将视觉截图改为有基线的断言。
- [ ] 回归原有测试、整页浏览、无脚本和减少动态效果，更新 README 的真实运行方法与尚未验证的平台。

计划提供的脚本入口：

```json
{
  "verify": "tsx scripts/verify.ts",
  "test:unit": "vitest run",
  "test:e2e": "playwright test"
}
```

verify 顺序为 `check:content → typecheck → test:unit → build → test:e2e`，再串行执行 `/personal/` 构建与资源冒烟；子路径产物建议输出 `.generated/subpath-dist`。字体准备在 build/dev 准备链中显式执行。验证脚本不负责安装或升级依赖。

## 验收记录与交付

每项任务完成后记录实际修改文件、命令与退出码、截图路径、资源对比及未解决问题。有 Git 时可按可验收任务形成小提交；当前无 Git 时不伪造提交记录，也不把初始化仓库作为执行前提。

最终运行 `npm run verify`，并按方案 A01–A12 逐项填写结果。没有执行的 Safari/Firefox、真实缩放或真机检查必须标为未验证。所有阶段通过后才能更新项目完成状态；测试通过与个人资料可公开发布是两项独立判断。

本计划中的文件创建、测试示例与命令尚未执行，当前只完成文档交付。
