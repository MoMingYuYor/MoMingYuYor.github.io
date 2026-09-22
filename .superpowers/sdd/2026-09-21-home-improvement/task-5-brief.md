# Task 5 Brief：增加当前章节定位

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第三阶段的当前章节指示。

## 需求原文（技术方案 5.3 + 实施计划 T5，逐条落实）

### 技术方案 5.3 当前章节指示

新增 `useSectionSpy(sectionIds, headerOffset)`，返回 `activeSectionId` 并负责监听清理。观察目标仅为当前可见章节。通过 IntersectionObserver 维护候选，在被 Header 遮挡线下最接近视口上部的章节中选当前项；大章节覆盖屏幕时保持其选中，页面到底时选最后可见章节。初次 hash 跳转与浏览器前进后退后同步观察状态。

Header 在对应链接设置 `aria-current="location"`，同时用短线或字重变化显示当前位置。滚动观察只改变展示状态，不修改 hash、不调用 `pushState`、不移动焦点。内容为空移除章节时同步移除观察目标。动画和吸附不作为该功能的依赖。

### 实施计划 T5

输入：App 已有的可见 `navSections`。输出：`useSectionSpy(sectionIds: Ref<string[]>, headerOffset: Ref<number>): { activeSectionId: Ref<string> }`；Header 接收 `activeSectionId` 并渲染 `aria-current="location"`。

- 先写滚动到作品区后仅作品导航带 aria-current 的用例，确认当前实现不满足（测试先行）。
- 实现观察器、目标变更与卸载清理；使用技术方案定义的视口上部选择规则，不用最大面积比例导致长章节失选。
- 对大章节、页尾、缺少兴趣、直接 hash 和浏览器后退逐项验证。

Header 呈现表达式：

```vue
<a :href="`#${section.id}`"
   :aria-current="section.id === activeSectionId ? 'location' : undefined">
  {{ section.label }}
</a>
```

运行：`npm run test:e2e -- tests/e2e/section-spy.spec.ts`。测试记录滚动前后的 `location.hash` 与 `history.length`，纯滚动不应改变它们。通过依据为 A06。

## 当前代码事实

- `src/composables/useMediaQuery.ts`：现有 composable 风格参考（`useMediaQuery(query: string): Ref<boolean>`，只读 ref + cleanup）。
- `src/App.vue`：`navSections` computed（home + 可见章节），传给 Header；章节顺序 Hero(#home) → InterestGallery(#interests) → ProjectGallery(#projects) → AboutSection(#about)；空数组章节不渲染（hasInterests/hasProjects）。
- `src/components/Header.vue`：T1 刚改造过——`openPanel` 互斥面板状态、`sections` prop 渲染 `nav-link` 列表、`is-scrolled` 滚动态。**先读当前实现再动手**。
- Header 高度 token：`--header-height: 64px`（tokens.css）。headerOffset 即可用该值（`--header-height + 24px` 与 scroll-margin-top 一致，取 88 或直接 64，报告说明）。
- 章节标题元素：`${sectionId}-heading`（tabindex="-1"），章节 section 元素 id 为 `${sectionId}`。
- global.css 有 `section[id] { scroll-margin-top: calc(var(--header-height) + 24px) }`。

## 顺带修复项（T1 评审转来）

`src/components/Header.vue` 品牌链接上的 `@click="onNavClick('home')"` 是无效绑定（外部 pointerdown 已先关面板，guard 直接 return）——删除该绑定，保留原生 `href="#home"` 行为。

## 实现要点提示

- IntersectionObserver rootMargin 用 header 遮挡线：如 `rootMargin: '-88px 0px -55% 0px'` 之类的上部条带；"最接近视口上部的章节"与"大章节保持选中"可用"当前条带内最后一个越过遮挡线的章节"或记录各 section 的 boundingClientRect 判断（不用最大面积比例）。选择规则在报告里写清楚。
- `sectionIds` 变化（章节因空数据移除/新增）时同步 observe/unobserve——watch sectionIds。
- hashchange / popstate 后不强制改 activeSectionId（观察器自然更新），但 hash 直跳后要立即正确——可在 nextTick 后手动评估一次。
- 组件卸载断开 observer（App 级使用，实际不卸载，但清理契约要有）。

## 全局约束

- 纯滚动不修改 hash、不 pushState、不移动焦点（e2e 断言）。
- 不得削弱现有测试；e2e home.spec 5 例 + navigation.spec 10 例、单测 65 项保持通过。
- 跑 e2e 前确认 4173 端口无残留进程（netstat 检查，有则 taskkill PID）。
- 桌面与窄屏导航都要有 aria-current 与视觉指示（窄屏菜单里也适用）。
- 你不碰：Hero.vue、GallerySection.vue、tokens.css、global.css、main.ts、src/lib/**（T3 正在并行修改前三者；tokens/global 由 T3 负责）。

## 交付与报告契约

- 修改：src/components/Header.vue、src/App.vue；新增：src/composables/useSectionSpy.ts、tests/e2e/section-spy.spec.ts。
- 测试先行：先写 section-spy.spec.ts 首例并在当前实现上确认失败（存输出 .generated/t5-red-output.txt），再实现。
- 完整报告写入 task-5-report.md：改动文件、选择规则说明、每个验证点（大章节/页尾/缺章节/hash 直跳/后退/历史不污染）的验证方式与结果、测试命令与输出、遗留。
- 最终回复：状态 / 改动文件 / 一行测试结论 / 关注点。
