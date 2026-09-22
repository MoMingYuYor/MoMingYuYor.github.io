# Task 1 Brief：让手机导航与主题控制完整可用

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第一阶段的第一项，修复手机顶栏溢出与键盘焦点问题。

## 需求原文（技术方案 3.1 + 实施计划 T1，逐条落实）

### 技术方案 3.1 手机顶栏与焦点契约

1024px 及以上保留桌面章节导航和现有主题三态。小于 1024px 使用紧凑品牌、单个主题入口、菜单按钮，主题三态进入展开面板。320px 时容器两侧 16px，两个入口各至少 44×44px，间距 8px；品牌允许缩短为"暮色"或"晴光"，不通过缩小触摸目标腾出空间。

菜单使用普通 disclosure navigation，不套用应用程序菜单的 `role="menu"`。打开时在 Vue `nextTick` 后聚焦第一个可见章节链接；Escape 关闭并返回触发按钮。点击外部区域关闭但不抢夺外部目标焦点。选择章节后保留原生 hash 与历史行为，关闭菜单并聚焦对应章节标题。对同一 hash 的重复点击也要处理。关闭面板不得继续包含可 Tab 到的隐藏链接。切换至桌面断点时清除手机展开状态；若焦点处于即将隐藏的触发器，转到桌面对应可见入口。

主题面板使用三项原生 radio：跟随系统、浅色、深色。`ThemeSwitch` 内只保留一组真实 radio，使用 CSS 与展开状态调整呈现，避免桌面和手机版本重复绑定同名 radio。触发器标识当前偏好；打开后聚焦当前选项。方向键使用原生 radio 行为，选择后立即应用但保持面板打开，Escape、外部点击或再次点击触发器关闭。导航面板与主题面板互斥；父组件掌握打开的面板，避免两个浮层重叠。

### 实施计划 T1

输入：Header 的 `sections` 和已有 `useTheme()`。输出：父组件中的 `openPanel: 'navigation' | 'theme' | null`，主题控件通过 `open` 属性与 `update:open` 事件同步；菜单选择继续使用现有原生锚点。

- 先在新 E2E 中固定 320px，断言菜单按钮完整处于视口，再验证 Enter 打开后首个导航链接获得焦点；确认当前实现至少在该场景失败（测试先行）。
- 修改 Header/ThemeSwitch，按技术方案 3.1 实现互斥展开、焦点进入、Escape、外部点击、同锚点选择和断点切换。
- 在 390/768/1024px 复核，验证主题三态和已有持久化测试仍通过。

### 首个回归断言（计划提供，写入 tests/e2e/navigation.spec.ts，可按需调整选择器但保留断言意图）

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

运行：`npm run test:e2e -- tests/e2e/navigation.spec.ts`。通过依据为验收 A01（320/390/768/1024/1440px 深浅主题下关键控件 bounding box 完整落在视口内）、A02（焦点进入/关闭回落/历史不被污染）。

## 当前代码事实

- `src/components/Header.vue`：现有 `mobileOpen` ref、`onNavClick(sectionId)`（含同锚点与 hashchange 焦点处理）、`onEscape`、桌面导航 `<nav id="site-nav">`、`nav-toggle` 按钮（<1024px 显示）、brand 显示主题标签"暮色 / DARK"或"晴光 / LIGHT"（来自 `useTheme().effectiveTheme`）。
- `src/components/ThemeSwitch.vue`：三项原生 radio（system/light/dark）radiogroup，桌面直接平铺三态；窄屏 CSS 隐藏文字标签只留图标。它自己调用 `useTheme()`。
- `useTheme()`（src/composables/useTheme.ts）提供 `preference`、`setPreference`、`effectiveTheme`，模块级单例。
- Header 的样式断点是 1023px（max-width）。

## 全局约束

- `personal-home:theme` 与 system/light/dark 三态不变；主题切换不得重置图库、焦点和滚动。
- 主要断点 640/1024px；320px 容器两侧 16px。
- 初始基线是 47 项单测和 5 项 E2E 通过；不得删除或削弱现有测试（tests/e2e/home.spec.ts 与 tests/unit/* 全部保持通过）。
- 演示文案可用，不虚构真实内容。
- 桌面（≥1024px）行为与视觉保持现状（桌面三态平铺可保留），新增的是窄屏紧凑形态与互斥面板。

## 实现要点提示（不替代方案原文）

- `openPanel` 状态放 Header（父组件），ThemeSwitch 改为接收 `open` prop + `update:open` emit；radio 组本体只有一组，桌面与窄屏只是呈现差异（CSS）。
- "外部点击关闭但不抢夺外部目标焦点"：用 document 上的 pointerdown 监听判断点击目标是否在面板/触发器内，关闭时不要 focus 到别处，让点击自然落点生效。
- "断点切换清除展开状态"：用现有 `useMediaQuery` 或 matchMedia 监听跨过 1024px 时置 `openPanel = null`。
- 打开导航面板聚焦第一个链接、打开主题面板聚焦当前选中 radio，均 nextTick 后执行。

## 交付与报告契约

- 修改：src/components/Header.vue、src/components/ThemeSwitch.vue；新增：tests/e2e/navigation.spec.ts。
- 禁止派发任何子代理；禁止修改本任务清单之外的文件（若发现必须改动其他文件才能完成，改报 BLOCKED 并说明）。
- 测试先行：先写 navigation.spec.ts 并确认在当前实现下失败（记录失败输出），再实现。
- 完成后把完整报告写入 .superpowers/sdd/2026-09-21-home-improvement/task-1-report.md：改动文件清单、每个验收点的验证方式与结果、测试命令与输出摘录、遗留问题。
- 最终回复只需：状态（DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED）、改动文件列表、一行测试结论、关注点（如有）。
