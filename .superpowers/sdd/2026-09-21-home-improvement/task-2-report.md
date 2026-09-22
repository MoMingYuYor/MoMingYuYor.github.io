# Task 2 报告：修正图库单项语义和图片失败

状态：DONE_WITH_CONCERNS（本任务全部验收点通过；关注点为 T1 的 navigation.spec.ts 既有失败，与本任务改动无关，见"遗留问题"）。

## 改动文件清单

| 文件 | 变更 |
| --- | --- |
| `src/components/GallerySection.vue` | 核心改造（见下） |
| `src/lib/gallery.ts` | 新增纯函数 `withFailedUrl(failed, url)`（按 URL 记录失败状态，返回新集合不改输入） |
| `tests/unit/gallery.test.ts` | 新增 `withFailedUrl` 3 项单测（17 → 20 项，原 17 项未削弱未改动） |
| `tests/components/gallery.spec.ts` | 新增组件测试 15 项（happy-dom 环境注解） |
| `vite.config.ts` | `test.include` 纳入 `tests/components/**/*.spec.ts`；environment 保持 node 默认，DOM 环境仅由文件级注解声明 |
| `package.json` / `package-lock.json` | devDependencies 新增 `@vue/test-utils@^2.5.1`、`happy-dom@^20.14.5`（npm 锁定） |

RED 阶段完整输出存档：`.generated/task-2-red-output.txt`（9 失败 / 6 通过）。

## GallerySection.vue 具体修改

1. **单项悬空 ARIA（方案 3.2 / A03）**：面板 `role="tabpanel"` 与 `aria-labelledby` 改为 `items.length > 1 ? ... : undefined`，1 项时只渲染普通内容区（无 tablist/tab/tabpanel，无指向不存在标签的引用）。0 项时 `gallery-main` 不渲染（App.vue 已有 `hasInterests` 同步隐藏章节与导航，未改动）。
2. **图片与文字同处当前内容区域（方案 3.2）**：主图 `figure.gallery-media` 从面板外部移入每个面板内部，激活面板同时包含图片、标题、说明与链接插槽；DOM id 仍为 `${sectionId}-panel-${id}` 前缀形式。CSS 相应调整：`.gallery-panel` 去掉 `margin-top`，`.gallery-media` 改 `margin: 0 0 24px`，保持原有图文间距与整体布局。
3. **失败状态按 URL 记录（方案 3.2）**：`failedIds: Set<条目id>` 重构为 `failedUrls: ReadonlySet<资源URL>`，经 `withFailedUrl` 纯函数更新。主图与缩略图均按 `item.image.src` 记录/查询 → 主图与同 URL 缩略图共享失败标记；切换到其他 URL 的图片不继承；同一条目更换 URL 后不在失败集合内，自动允许重新加载。
4. **缩略图失败占位**：缩略图 `img` 增加 `@error="markFailed(item.image.src)"` 与 `v-if/v-else`——失败时渲染 `.gallery-tab-thumb-fallback`（104×68 主题色块，同尺寸预留，无破损图标，无布局跳动）。主图失败沿用 `.gallery-frame`（aspect-ratio 16/10 + `var(--surface-bg)`）内 `.media-fallback` 显示替代文本。
5. **选中项滚入选择器（方案 3.2 全局约束）**：新增 `watch(activeId)`，激活项变化后 `nextTick` 对选中 tab 调 `scrollIntoView({ block: 'nearest', inline: 'nearest' })`——只滚选择器容器，不把整页拉回顶部；`items.length < 2` 时跳过（无 tablist）。
6. **键盘契约保留**：`onKeydown`（桌面竖向上下键 / 手机横向左右键 / Home/End / 边界循环）与 `selectAfterRemoval` 回退逻辑未动；删除了不再使用的 `activeItem` computed（模板改用 `v-for` 局部 `item`）。

## 验收点验证（方案验收表 A03 / A12）

| 验收点 | 验证方式 | 结果 |
| --- | --- | --- |
| A03：空章节同步隐藏 | 组件测试"0 项：不渲染 tablist、tab、tabpanel 与任何图片"（组件层）；App.vue `hasInterests` 既有控制（未改动）；e2e home.spec 首页章节用例仍绿 | 通过 |
| A03：单项没有悬空 ARIA | 组件测试"显示普通内容区：无 tablist/tab/tabpanel"与"不留指向不存在标签的 aria-labelledby"（遍历所有 `[aria-labelledby]` 断言引用目标存在） | 通过 |
| A03：删除当前项回退 | 组件测试"删除激活项后选中原位置的下一项"（点击 b → setProps 移除 b → 选中 c） | 通过 |
| A03：图片请求失败 | 组件测试 5 项：主图失败显示 `.media-fallback`（替代文本）且面板内无 img；主图/缩略图同 URL 共享；缩略图失败主图同步；切换不继承、切回仍记忆；更换 URL 重新加载 | 通过 |
| A03：两个章节同名条目 | 组件测试"两个章节的同名条目因章节前缀不冲突"（`#interests-panel-a` 与 `#projects-panel-a` 各存在一次） | 通过 |
| A03：多项 tabs 键盘契约 | 组件测试：桌面 ArrowDown 移动并聚焦新标签；移动 ArrowRight 移动、ArrowDown 无效；`aria-controls` 逐个指向真实 tabpanel；同时仅一个可见面板 | 通过 |
| A03：选中项滚入选择器 | 组件测试：点击第三项后 `scrollIntoView` 以 `{ block: 'nearest', inline: 'nearest' }` 恰被调用一次（spy 断言，不拉整页） | 通过 |
| A12：动画直接终态；无脚本静态可用 | 本次改动未新增任何动画/过渡；失败占位为静态主题色块（直接终态）；无脚本联系入口链路未触及（`index.html` noscript 注入与 prepare-site 链路未改动），`npm run build` 全量构建通过 | 通过（无回归） |

## 测试先行记录（RED → GREEN）

1. 先写 `tests/components/gallery.spec.ts`（15 项），在改造前实现上运行：

   ```
   npx vitest run tests/components/gallery.spec.ts
   Tests  9 failed | 6 passed (15)
   ```

   失败项即本次修复点：单项 tabpanel/悬空 labelledby ×2、图文同面板、scrollIntoView、失败状态 ×5（主图占位作用域、缩略图共享 ×2、切换继承、URL 重载）。完整输出存 `.generated/task-2-red-output.txt`。首次运行曾因测试夹具 src 使用前导斜杠被 `isSafeAssetPath` 拒绝而全红（14/15），修正夹具为资源键形式后取得上述真实基线。

2. 实施组件与纯函数改造后：

   ```
   npx vitest run tests/components/gallery.spec.ts tests/unit/gallery.test.ts
   Test Files  2 passed (2)
   Tests  35 passed (35)   # 组件 15 + gallery 纯函数 20
   ```

3. 全量验证：

   ```
   npm run typecheck      # vue-tsc + tsc 无错误
   npm run test:unit      # 5 files, Tests 65 passed (65)
   npm run test:e2e       # home.spec.ts 5 passed；navigation.spec.ts 8 failed（见遗留问题）
   npm run build          # ✓ built（生产构建含新组件模板）
   ```

## 遗留问题（均为本任务范围之外）

1. **`tests/e2e/navigation.spec.ts` 8 项失败**：该文件属 T1（手机顶栏改造，测试先行），失败原因均为 T1 目标行为尚未实现/进行中——`getByRole('button', { name: '主题偏好' })` 在 src 中不存在（ThemeSwitch 当前是平铺 radiogroup）、nav-toggle 320px 溢出、断点焦点转移契约未实现。与 T2 改动无关：progress.md 预检裁决 T1/T2 无共享文件并行；本任务未触碰 Header.vue / ThemeSwitch.vue / 全局样式；本任务基线 e2e（home.spec.ts 5 项，含画廊键盘导航）全部通过。
2. 组件测试未覆盖真实网络图片加载（happy-dom 无网络），失败态均以 `trigger('error')` 模拟，与真实浏览器 error 事件同路径。
3. 隐藏面板（v-show）各含一张 `loading="lazy"` 的 img，display:none 下不会请求，切换时才加载——与改造前"切换换 src"的请求时机等价，未发现额外请求放大；如后续条目数量显著增加可在 T3/T8 复核。
