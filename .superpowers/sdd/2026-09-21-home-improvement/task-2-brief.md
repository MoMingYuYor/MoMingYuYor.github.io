# Task 2 Brief：修正图库单项语义和图片失败

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第一阶段的第二项，修复图库 0/1/多项语义与图片失败状态。

## 需求原文（技术方案 3.2 + 实施计划 T2，逐条落实）

### 技术方案 3.2 图库状态与图片失败

0 项由 App 隐藏章节及导航。1 项显示普通 `figure` 与内容区，不渲染 tablist，也不留下 `role="tabpanel"` 或指向标签的 `aria-labelledby`。多项遵循当前 tabs 模式：桌面竖向上下键，手机横向左右键，Home/End 及边界循环保持一致。选中项必须滚入选择器可见区域，横向滚动仅影响选择器，不把整个页面拉回顶部。

图片失败状态按资源 URL 记录，主图与同 URL 缩略图共享；切换到其他图片不继承失败标记。同一条目更换 URL 后允许重新加载。失败时使用固定比例主题色占位，保留标题、说明和可用链接，不显示破损图片图标。所有图片预留尺寸，失败不能造成布局跳动。图片与对应文字共同处于可访问的当前内容区域；DOM id 始终带章节前缀。

### 实施计划 T2

输入：已有 `items` 与 `activeId`；输出：0/1/多项对应语义、按 URL 管理的失败状态。保留多项键盘契约。

- 安装锁定的 `@vue/test-utils` 与 DOM 测试环境作为开发依赖；只让 `tests/components` 使用 DOM 环境，原纯函数测试仍用 Node。
- 为单项建立测试，断言没有 tablist、没有 tabpanel，标题和图片仍存在。多项测试检查每个 `aria-controls` 指向实际面板。
- 增加缩略图 error 事件用例；修改组件让主图和缩略图均使用稳定占位，URL 更换后能够重新加载。
- 验证删除激活项、0 项及两个章节同名条目不冲突。

条件语义的实施起点（可在此基础上完善）：

```vue
<div
  :role="items.length > 1 ? 'tabpanel' : undefined"
  :aria-labelledby="items.length > 1 ? tabId(item.id) : undefined"
>
  <!-- 继续使用真实标题，不以 ARIA 标签替代可见内容 -->
</div>
```

运行：`npm run test:unit -- tests/components/gallery.spec.ts tests/unit/gallery.test.ts`。须调整 Vitest include 纳入组件目录；组件测试文件顶端使用对应的环境注解。组件挂载需要的 matchMedia stub 放在该测试内，不能污染生产代码。通过依据为 A03（空章节同步隐藏、单项没有悬空 ARIA、失败占位稳定）、A12。

## 当前代码事实

- `src/components/GallerySection.vue`：泛型组件（`generic="T extends GalleryItem"`），props：sectionId/number/heading/intro/items/aside。`activeId` ref + watch 回退（`src/lib/gallery.ts` 纯函数：normalizeActiveId/selectAfterRemoval/stepIndex/tabStepFromKey）。tabs 用 `role="tablist"` + button `role="tab"`，面板 `v-for + v-show` 渲染全部条目，`role="tabpanel"` + `aria-labelledby`。**当前失败状态按条目 id 记录（failedIds Set<string>），只覆盖主图**。缩略图 `<img class="gallery-tab-thumb">` 无 error 处理。
- 单项与 0 项现状：App.vue 用 `site.interests.length > 0` 控制章节显隐（0 项已隐藏）；但 1 项时当前实现渲染 tablist（items.length > 1 才渲染 tablist——检查 `v-if="items.length > 1"`，即 1 项时无 tablist，但面板仍有 `role="tabpanel"` + `aria-labelledby` 指向不存在的 tab id，且 1 项时没有标签按钮）。**这是要修的悬空 ARIA**。
- 缩略图与主图同 URL（`item.image.src`），主图失败标记按 id——与方案"按 URL 记录、主图与缩略图共享"不一致，需重构为按 URL 的 Map/Set。
- `vite.config.ts`：`test.include: ['tests/unit/**/*.test.ts']`，environment 'node'。需纳入 `tests/components/**` 并允许文件级环境注解（`// @vitest-environment jsdom` 或 happy-dom，装一个即可）。
- `src/lib/gallery.ts` 有 17 项纯函数单测（tests/unit/gallery.test.ts），不得削弱。

## 全局约束

- 保留多项 tabs 模式与键盘契约（桌面竖向上下键、手机横向左右键、Home/End、边界循环）——现有行为不许退化。
- "选中项滚入选择器可见区域，横向滚动仅影响选择器，不把整个页面拉回顶部"：激活切换时对选中 tab 调用 `scrollIntoView({ block: 'nearest', inline: 'nearest' })` 或等价方式，避免页面级滚动。
- 初始基线 47 项单测 + 5 项 E2E 保持通过；新增测试不得用删除原测试换取通过。
- 组件测试的 matchMedia stub 放在测试内（GallerySection 用了 useMediaQuery），不污染生产代码。
- DOM 测试环境依赖（jsdom 或 happy-dom）与 @vue/test-utils 版本与当前 Vue 3.5 / Vitest 5 核定后写入 package.json devDependencies，由 npm 锁定。

## 交付与报告契约

- 修改：src/components/GallerySection.vue、vite.config.ts、package.json（+lockfile）；新增：tests/components/gallery.spec.ts（及所选 DOM 环境依赖）。
- 禁止派发任何子代理；禁止修改任务清单之外的文件（如必须，改报 BLOCKED 并说明）。
- 测试先行：先建组件测试环境与单项/多项/失败用例，确认当前实现失败点（记录输出），再改组件。
- 完成后把完整报告写入 .superpowers/sdd/2026-09-21-home-improvement/task-2-report.md：改动文件清单、每个验收点的验证方式与结果、测试命令与输出摘录、遗留问题。
- 最终回复只需：状态（DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED）、改动文件列表、一行测试结论、关注点（如有）。
