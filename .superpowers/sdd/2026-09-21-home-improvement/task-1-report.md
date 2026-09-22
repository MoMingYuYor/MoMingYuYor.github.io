# Task 1 报告：让手机导航与主题控制完整可用

状态：**DONE**。需求原文、约束与验收依据见 task-1-brief.md（技术方案 3.1 + 实施计划 T1）。

## 改动文件清单

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| `src/components/Header.vue` | 修改 | `openPanel: 'navigation' \| 'theme' \| null` 父组件唯一面板状态；`themeOpen` 可写 computed 以 `v-model:open` 同步 ThemeSwitch；紧凑品牌（`暮色`/`晴光`，<1024px 显示）；菜单打开后 nextTick 聚焦首个章节链接；Escape 关闭并回落触发器；document pointerdown 外部关闭（不移焦）；断点切换清除展开状态并按 focusout 标记把焦点转到新断点可见入口；同锚点点击延迟到宏任务聚焦（见“关键实现事实”）；`header-actions` 窄屏间距 8px |
| `src/components/ThemeSwitch.vue` | 修改 | 新增 `open` prop + `update:open` emit；**仍只有一组真实 radio**（桌面平铺 / 窄屏面板只是 CSS 呈现差异）；44×44 触发器标识当前偏好（glyph + `aria-label="主题偏好：<当前项>"`）；打开后聚焦当前选中项；Escape 关闭并回落触发器；外部 pointerdown 关闭（不移焦）；断点切换焦点修复（→桌面聚焦平铺当前项，→窄屏聚焦触发器）；原 640px 隐藏标签的窄屏形态移除（窄屏不再平铺） |
| `tests/e2e/navigation.spec.ts` | 新增 | 10 个用例：320px 回归断言（brief 原文逐字保留 + 44×44/8px 触摸目标断言）、A01 全断点双主题视口检查、320px 两侧 16px、主题面板焦点契约、面板互斥、外部点击不移焦、菜单选择原生 hash/历史/同锚点、三个断点切换焦点用例 |
| `.superpowers/sdd/2026-09-21-home-improvement/task-1-report.md` | 新增 | 本报告 |

未修改其它源文件；`dist/`、`.generated/`、`test-results/` 为测试命令的构建产物/输出目录。

## 测试先行证据

先写 `tests/e2e/navigation.spec.ts` 并在改动前实现上运行：

- 命令：`npx playwright test tests/e2e/navigation.spec.ts`
- 结果：**8 failed / 2 passed**，完整输出存于 `.generated/t1-navigation-pre-impl-failures.txt`。
- 关键失败（对应 brief 预期的场景）：`320px 菜单完整可见且打开后焦点进入导航` 中菜单按钮右缘 `x + width = 344.59 > 320`（溢出视口）；主题触发按钮、面板互斥、断点焦点等用例均因对应能力不存在而失败。

## 验收点验证方式与结果

| 验收点 | 验证方式 | 结果 |
| --- | --- | --- |
| A01：320/390/768/1024/1440px 深浅主题下关键控件 bounding box 完整落在视口内 | 用例“关键控件在全部断点与双主题下完整落在视口内”：10 组（5 宽度 × light/dark）逐一断言品牌、主题入口/菜单按钮（窄屏）或全部导航链接/主题 radio（桌面）四边均在视口内 | 通过 |
| 320px 容器两侧 16px；两入口各 ≥44×44、间距 8px | 320px 用例断言品牌 `x ≥ 16`，两入口 `width/height ≥ 44`，`间距 toBeCloseTo(8)` | 通过 |
| A02：焦点进入/关闭回落/历史不被污染 | 打开菜单断言首链接 `toBeFocused`；Escape/选择章节后断言触发器 `aria-expanded=false`；`goBack()` 恰好回到无 hash 首页；同锚点重复点击仍聚焦 `#projects-heading` | 通过 |
| 打开面板 nextTick 聚焦（导航首链接 / 主题当前项） | 导航：320px 用例；主题：390px 用例断言 `跟随系统` radio 聚焦 | 通过 |
| Escape 关闭并返回触发器 | 导航与主题各有断言（`toBeFocused` 触发器） | 通过 |
| 外部点击关闭且不抢夺外部目标焦点 | 点击 `#interests` 画廊 tab：菜单关闭且该 tab `toBeFocused`（关闭路径无任何主动 focus 调用） | 通过 |
| 关闭面板不含可 Tab 的隐藏链接/选项 | `display:none` 实现；用例断言关闭后 radio `toBeHidden` | 通过 |
| 面板互斥（父组件掌握 openPanel） | 用例“导航与主题面板互斥”往返切换；另经 390px 截图目检两面板形态 | 通过 |
| 主题三态与持久化不变 | home.spec“主题切换与持久化”通过；radio 仍为原生单组，`personal-home:theme` 键未动 | 通过 |
| 桌面 ≥1024px 行为与视觉保持现状 | home.spec 全部通过；1440px 截图与原版形态一致（平铺导航 + 三态胶囊） | 通过 |
| 断点切换清除展开状态、触发器焦点转桌面入口 | 三个专用用例：菜单展开跨断点、焦点在导航触发器跨断点、焦点在主题触发器跨断点 | 通过 |

## 测试命令与输出摘录

```
npx playwright test tests/e2e/navigation.spec.ts
  → 10 passed (6.0s)

npm run test:e2e            # 全量
  → 15 passed (6.2s)        # 原 home.spec 5 项 + 新增 navigation.spec 10 项

npm run test:unit
  → Test Files 5 passed (5) / Tests 65 passed (65)
                            # 含 tests/unit 4 个文件与 tests/components/gallery.spec.ts

npm run typecheck           # vue-tsc + tsc，无错误
```

双主题整页截图（home.spec）照常产出；另存目检截图 `.generated/screenshots/t1-{320,390,1440}-*.png`（320 紧凑形态、390 导航/主题面板展开、1440 桌面原样）。

## 关键实现事实（后续任务需要知道的）

1. **断点焦点修复依赖 focusout 标记**：实测（Chromium 144）聚焦元素被 `display:none` 隐藏时浏览器先把焦点修复到 body，且 matchMedia `change` 事件在修复**之后**才触发——在 watcher 里读 `activeElement === 触发器` 永远为 false。唯一线索是触发时 `focusout` 的 `relatedTarget === null`。Header/ThemeSwitch 各自记录该标记（document `pointerup` 会清除它，以排除“点击空白处导致的 body 焦点”误判），跨断点时据此把焦点移到新断点的可见入口。两组件重复了约 15 行该逻辑（禁止新建文件，故未抽 composable）。
2. **同锚点重复点击的聚焦必须延迟**：点击同文档锚点时，Chrome 会在锚点默认动作里把焦点重置回 body（与原实现注释“过早聚焦会被随后的锚点行为重置”同源）。hashchange 路径天然在导航完成后聚焦，同锚点分支改为 `setTimeout(0)` 宏任务聚焦，实测稳定（原同步聚焦会被重置吞掉）。
3. **桌面视觉零改动**：`.theme-panel` 桌面样式 = 原 `.theme-switch` 平铺组样式；`radiogroup` 角色从外层容器移到面板元素上，radio 的 aria-label 与可见胶囊不变，home.spec 的 `getByRole('radio', { name })` 选择器不受影响。
4. Header 的 `is-open` 现表示“任一面板展开”（头部背景），导航面板显隐用独立的 `is-nav-open` 类，避免主题面板展开时窄屏导航被连带显示。

## 遗留问题 / 未覆盖项

- 主题面板的“外部点击关闭”与导航面板共用同一机制（document pointerdown + 不移焦），E2E 只对导航面板显式断言；未单独为主题面板写外部点击用例。
- 断点焦点修复的 focusout 标记是启发式：极端时序（如隐藏与指针抬起同帧竞态）理论上可能漏恢复一次焦点，属可用性小瑕疵，不影响功能与测试。
- brief 基线写作“47 项单测”，当前仓库实际为 65 项（含 `tests/components/gallery.spec.ts` 15 项组件测试，不涉及 Header/ThemeSwitch）；本次全部通过，无回归。
- 排查期间曾出现“修复未生效”假象：手动启动的 `vite preview` 子进程未被父进程退出连带终止，占用 4173 端口导致 Playwright `reuseExistingServer` 复用旧构建。已清理并复测；后续任务注意在本机手动起 preview 后要彻底结束其 node 子进程。
