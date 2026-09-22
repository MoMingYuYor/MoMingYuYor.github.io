# Task 4 报告：兴趣与作品分层，加入页内详情

状态：完成。方案 5.1/5.2 与实施计划 T4 逐条落实，全部测试通过：typecheck ✅、单测 112/112（基线 104 + 新增 8，既有用例零削弱）、e2e 34/34（既有 34 例零新增用例，visual 步骤扩充）。RED 证据存 `.generated/t4-red-output.txt`。

## 改动文件

- `src/components/GallerySection.vue`：新增必填 prop `variant: 'interest' | 'project'`；外观分支（缩略图有无与尺寸、卡片宽度、文字条、引文位置、主图焦点裁切）；键盘/选中/失败处理逻辑一行未动。
- `src/components/InterestGallery.vue`：显式传 `variant="interest"`（一行）。
- `src/components/ProjectGallery.vue`：显式传 `variant="project"`；details slot 按 5.2 重构（成果摘要独立成行 + 原生 `<details>` 收纳角色/时间/背景 + 链接保持在外）；新增会话展开状态。
- `tests/components/project-details.spec.ts`：新增，8 例（RED 先行两例 + 结构/交互/状态 6 例）。
- `tests/components/gallery.spec.ts`：最小适配 2 处（见下）。
- `tests/e2e/visual.spec.ts`：projects 章节新增详情展开截图步骤（含折叠断言与原生键盘展开验证），每轮截图 30 → 40 张。

未触碰禁改清单：Header.vue、App.vue、Hero.vue、tokens.css、global.css、main.ts、src/lib/**、src/bootstrap/**、scripts/**、vite.config.ts、index.html。site.ts 未改，演示占位保持"演示/待补充"字样，未撰写虚构成果。

## variant 分支说明（5.1，逐处）

variant 只进外观分支；选中、键盘、失败处理、激活项回退、scrollIntoView 完全共用 `src/lib/gallery.ts` + GallerySection 现有实现，未复制任何状态逻辑。根元素挂 `gallery-section--{variant}` 类承载 CSS 分支。

| 分支点 | 兴趣（interest） | 项目（project） |
| --- | --- | --- |
| 选项缩略图（JS `showTabThumb`） | 移动端不渲染（纯文字主题条）；桌面渲染 | 全断点渲染 |
| 缩略图尺寸（`tabThumbSize` + CSS） | 桌面 72x48（沿用 T3，64–80px 档） | 64x40（参数表"作品 48–64px"取上限，与主图 16/10 同比例；T3 的 72px 按参数表收敛，报告记录） |
| 选项卡片 | 移动端文字条：单行主题名 + 箭头、`width: auto; max-width: 72vw`、padding 12/16；摘要隐藏。桌面卡片不变 | 移动端紧凑选择器 `width: 248px`（原 272px）、网格首列 64px；桌面不变 |
| 主图比例（`.gallery-frame` aspect-ratio） | 16/10 | 16/10（两 variant 当前同值；分支点已收敛到该规则并注明，未来调整改一处） |
| 截图完整显示 | `.gallery-frame.is-screenshot` contain + padding 规则保持，variant 不影响 | 同左（当前演示数据全为 photo，规则待截图素材接入后生效） |
| 装饰引文位置 | 移动端渲染在 `.gallery-main` 之后（`v-if="aside && variant === 'interest' && !isDesktop"`），实现 5.1 手机优先顺序：主题条→主图→短说明→引文；桌面在侧栏列表底部 | 保持现状：侧栏列表底部（移动端在横滚列表下方） |
| 照片焦点裁切 | 两 variant 共用：主图 `:style="frameImageStyle(item.image)"`，按断点取 `ImageAsset.desktopPosition/mobilePosition` 映射 `object-position`，未配置时浏览器默认居中（演示数据未配置，当前无行为变化） | 同左 |

`isDesktop`（`useMediaQuery(QUERY_DESKTOP)`）与 CSS 断点（min-width: 1024px）同值，JS 分支（缩略图有无、引文位置）与 CSS 分支（尺寸、文字条）不会错位。

## 详情结构（5.2）

按简报结构起点实现于 ProjectGallery 的 `#details` slot：

```
<p class="project-outcome">（成果摘要，缺失不渲染）</p>
<details class="project-details" :open="expandedIds.has(item.id)" @toggle="…">
  <summary>项目详情</summary>
  <dl class="project-facts">角色 / 时间 / 背景（逐行 v-if，全空则整个 dl 不渲染）</dl>
</details>
<div class="project-links">访问项目 / 查看源码（保持在 details 外部，缺省不渲染）</div>
```

- 成果行左侧 2px 强调线引用式排版；summary 自绘旋转箭头（`→` 旋转 90° 表达展开态）、`min-height: 44px` 触摸目标、隐藏原生三角（含 `::-webkit-details-marker`）；展开区不设固定高度。
- 摘要不嵌套任何按钮/链接（单测断言 summary 是 details 首个元素子元素且无交互后代）；Enter/Space 由浏览器原生处理，代码未拦截键盘。
- 缺失字段隐藏对应事实行：`vi.mock` 站点替身（空字段项目）验证空成果/空事实/无链接三种隐藏。

## details 展开状态的会话保持实现

- `ProjectGallery` setup 内 `expandedIds = ref<ReadonlySet<string>>`，按项目 id 记忆；`:open` 绑定使任何重渲染都恢复状态，`@toggle` 把原生开合同步回集合。
- 防回环：`onDetailsToggle` 仅在与已记录状态不一致时写入（`:open` 的程序化回写也会触发 toggle，守卫使其成为 no-op）。
- 主题切换只改根元素 `data-theme` 属性（App.vue 事实：无 :key、无重建）、切换项目只对非激活面板 v-show——两者都不清空集合。单测分别验证：切走再切回展开保持/收起保持；改 `data-theme` 属性后 details 节点同一（`toBe` 元素同一性）且仍展开。
- 作用域为组件实例级 = 本次会话级：SPA 单次挂载，实例存活整个会话；未做模块级/持久化存储（刷新重置属预期，"本次会话"不要求跨刷新；组件重挂载场景当前应用不存在，YAGNI 不引入）。

## 每个验收点的验证方式与结果

| 验收点 | 验证 | 结果 |
| --- | --- | --- |
| 兴趣不展示项目事实 | project-details.spec 用例 1（挂载 InterestGallery 断言四类项目 DOM 不存在） | ✅（T4 前即满足，见 RED 说明） |
| 作品详情默认折叠 | 同文件用例 2：details 存在、`open === false`、成果摘要在 details 外、事实 dt 在 details 内、链接 `closest('details') === null` | ✅ RED → 实现 → ✅ |
| 原生键盘展开 | e2e（真实 Chromium）：visual.spec 展开步骤先 `summary.focus()` 再 `keyboard.press('Enter')`，断言 `toHaveAttribute('open')` 后截图；happy-dom 不实现 summary 键盘激活，故单测只断言结构前提（summary 首子元素、无嵌套交互元素） | ✅ |
| 折叠后内部内容退出 Tab 顺序 | 原生 details 语义保证；e2e 展开前断言 `.project-facts` `toBeHidden`；单测断言 details 内部无可聚焦元素 | ✅ |
| 项目切换/主题切换不错误重置 | 单测：切走再切回保持、收起保持、data-theme 变化后元素同一且状态保持 | ✅ |
| 焦点保持在所选标签 | 单测：ArrowDown 后 `document.activeElement.id === 'projects-tab-p2'` 且目标详情保持折叠；GallerySection 键盘契约未改动，gallery.spec 既有焦点用例全过 | ✅ |
| 链接独立可直接操作 | 单测：链接在 details 外、href 正确；无链接项目不渲染链接区 | ✅ |
| 现有列表项按 id 保留 DOM、主题不重建 | `:key="item.id"` 未动；未引入任何 theme 相关 key | ✅（结构检查） |
| 演示占位不虚构 | site.ts 未改，截图仍显示"待补充" | ✅ |

## RED 证据（.generated/t4-red-output.txt）

实现前仅跑先行两例：**1 failed / 1 passed**。失败例："作品详情默认折叠"——当前无 `details.project-details` 元素（`expected false to be true`）。通过例："兴趣不展示项目事实"——InterestGallery 在 T4 之前就不向 GallerySection 传 details slot，该不变式在现状即成立，用例作为回归保护保留。如实记录：两例中一例并非"失败转绿"，而是"已满足转受保护"。

## gallery.spec.ts 最小适配（2 处）

1. `mountGallery` options 类型加 `variant?: 'interest' | 'project'`，props 加 `variant: options.variant ?? 'interest'`——variant 成为必填 prop 且 tsconfig.app.json 包含 tests，不改则 typecheck 失败。既有 15 例语义全部保持（均为兴趣形态，默认值即原行为）。
2. "两个章节的同名条目因章节前缀不冲突"用例两处挂载显式传 `variant: 'interest'` / `variant: 'project'`，使章节语义与 variant 一致。

除上述外该文件零改动，15 例断言原样通过。

## visual.spec.ts 扩充与基线重拍

projects 截图后追加：折叠断言（`.project-facts` `toBeHidden`，即原生折叠语义在真实浏览器的验证）→ 键盘 Enter 展开 → `toHaveAttribute('open')` → 整节截图 `{prefix}-projects-details-{日期}.png`。每轮截图 30 → 40 张（5 视口 × 2 主题 × 4 部分）。

基线重拍：`.generated/visual-baseline/after/` 已由本次 e2e 原位重生成（40 张），反映 T4 外观——这是 T3 基线的预期演进。已人工目检 390-light-interests（文字主题条/主图/短说明/引文沉底的手机顺序）、390-light-projects-details（成果强调线、展开事实行、键盘 focus-visible 环）、1440-light-projects（64x40 缩略图、折叠详情入口、引文沉底）。注意：details 展开截图中的聚焦环是键盘操作的 `:focus-visible`，非样式回归。

## 测试输出

- `npm run typecheck`：通过（vue-tsc + tsc，无错误）。
- `npm run test:unit`：**112/112 通过**（11 文件）= 基线 104 + project-details 8。既有 gallery.spec 15 例无削弱。
- `npm run test:e2e`：**34/34 通过**（home 5 + navigation 10 + visual 10 + preload 4 + section-spy 5），一次通过未触发端口重试；运行前 netstat 确认 4173 无 LISTENING，运行后已释放。T6 在途未造成冲突。
- 先行单文件：`npx vitest run tests/components/project-details.spec.ts`（实现后 8/8）与简报要求的 `npm run test:unit -- tests/components/project-details.spec.ts` 等价。

## 遗留与关注点

1. 展开状态作用域为组件实例级（理由与边界见上节）；若未来出现会话内重挂载需求（如路由化），需提升为模块级或持久化，届时 `:open` 绑定 + toggle 同步机制可原样迁移。
2. 兴趣桌面缩略图 72x48 与项目 64x40 并存：参数表只约束作品 48–64px，兴趣桌面沿用 T3 取值（64–80px 档），未强行统一。
3. 主图比例两 variant 当前同值 16/10；方案只说 variant 决定比例未给数值，未擅自差异化，分支点已收敛待审阅。
4. `ImageAsset.mobileSrc/srcset` 响应式候选仍未接入画廊主图（T6 记录的 candidates 同步项一致），焦点裁切仅接了 object-position。
5. `.generated/t4-happydom-probe*.mjs` 探测脚本已删除；`t4-red-output.txt` 按契约保留。
