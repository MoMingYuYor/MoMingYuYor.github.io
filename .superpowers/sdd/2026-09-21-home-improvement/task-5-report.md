# Task 5 报告：增加当前章节定位

状态：**DONE**（本任务全部交付物绿；typecheck 与单测各有 1 处失败归属并行任务 T7 的 theme-bootstrap，详见"遗留与并行任务"）

## 改动文件

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| `src/composables/useSectionSpy.ts` | 新增 | 滚动观察 composable：`useSectionSpy(sectionIds: Ref<string[]>, headerOffset: Ref<number>): { activeSectionId: Ref<string> }` |
| `src/App.vue` | 修改 | 调用 `useSectionSpy`（sectionIds 取自 `navSections`，`headerOffset = ref(88)`），把 `activeSectionId` 传给 Header |
| `src/components/Header.vue` | 修改 | 新增 `activeSectionId` prop；导航链接按方案表达式渲染 `aria-current="location"`；`.nav-link[aria-current='location']` 视觉指示（颜色加深 + 底部 16px 短线，不动盒模型）；**顺带修复**：删除品牌链接上无效的 `@click="onNavClick('home')"`，保留原生 `href="#home"` |
| `tests/e2e/section-spy.spec.ts` | 新增 | 5 个 e2e 用例（见下） |
| `tests/unit/useSectionSpy.test.ts` | 新增 | 11 个单测（选择规则 / 目标变更 / 清理 / 降级） |
| `.generated/t5-red-output.txt` | 新增 | 测试先行 RED 证据 |

## 选择规则（技术方案 5.3 的落地方言）

1. **页尾兜底**：`scrollHeight - innerHeight - scrollY <= 1px`（滚到底）→ 选 sectionIds 最后一个章节。页尾短章节顶部可能永远越不过遮挡线，靠该兜底满足"页面到底时选最后可见章节"。
2. **常规**：按 DOM 顺序取最后一个顶部越过 Header 遮挡线的章节（`getBoundingClientRect().top <= headerOffset + 1px`）。大章节覆盖整屏时其后继章节尚未越线 → 保持选中；后继一旦越线即接管。**未用最大面积比例**，避免长章节失选。1px 容差的原因：浏览器滚动位按设备像素取整，锚点落点实测为 `top = 88.140625`，比遮挡线 88 多出 0.14px，无容差会把"恰在遮挡线上"的当前章节误判为未越线（e2e 首跑即暴露）。
3. **无越线章节**（首屏几何缺失等）→ 保持首个章节。

**headerOffset 取 88**：`--header-height(64px) + 24px`，与 `global.css` 的 `section[id] { scroll-margin-top: calc(var(--header-height) + 24px) }` 一致——锚点直跳后章节顶部恰好落在遮挡线上，立即命中当前项。

**触发时机**：IntersectionObserver（`rootMargin: '-88px 0px -55% 0px'` 上部条带，交叉变化即重估）+ window scroll/resize（rAF 合帧，覆盖"滚到底"等无交叉变化场景）+ hashchange/popstate（下一帧重估，保证直跳与前进后退立即正确）。观察目标仅为当前可见章节：`watch(sectionIds)` 同步 observe/unobserve（含内容为空移除章节）；`watch(headerOffset)` 按新阈值重建观察器。卸载断开 observer、移除全部监听并取消未决 rAF。纯滚动只更新 `activeSectionId`，不修改 hash、不 pushState、不移动焦点。

**视觉指示**：`.nav-link[aria-current='location']` 颜色加深（--text-primary）+ `::after` 底部 16px×2px 短线（--accent）。只改颜色与伪元素、不改盒模型，指示切换无布局抖动；桌面平铺导航与窄屏展开菜单共用同一 `.nav-link`，两处同时生效。

## 测试先行（RED）

先写 `section-spy.spec.ts` 首例并运行：`aria-current="location"` 元素 0 个（期望 1）→ 失败，输出存于 `.generated/t5-red-output.txt`（exit=1）。

## 逐项验证（brief 要求的验证点）

| 验证点 | 方式 | 结果 |
| --- | --- | --- |
| 滚动到作品区仅作品带 aria-current | e2e `滚动到作品区后仅作品导航带 aria-current，且不改变 hash、历史与焦点` | PASS |
| 纯滚动不污染历史（A06） | 同上用例 + `页面滚到底部选中最后可见章节`：记录滚动前后 `location.hash` 与 `history.length` 并断言不变；另断言滚动后焦点仍在 `#home-heading` | PASS |
| 大章节保持选中 | e2e `大章节覆盖屏幕时保持选中`：兴趣章节越线后 +240px 滚轮，作品区顶部前置校验仍在遮挡线下，保持兴趣选中 | PASS |
| 页尾选最后可见章节 | e2e `页面滚到底部选中最后可见章节，历史仍不被污染` | PASS |
| 直接 hash 打开 | e2e `直接 hash 打开页面立即指示对应章节`（goto `/#projects`，无任何测试侧滚动） | PASS（首跑失败暴露 0.14px 取整问题，加 1px 容差修复） |
| 浏览器后退/前进 | e2e `浏览器后退与前进后观察状态同步`：点击兴趣 → 后退回首页指示首页 → 前进恢复指示兴趣 | PASS |
| 缺少兴趣（章节移除同步移除观察目标） | 单测 `sectionIds 变化同步 observe/unobserve（缺少兴趣章节）`：`['home','interests','about']` → `['home','about']`，fake observer 观察表同步减少（e2e 内容静态无法变体，故在 composable 契约层验证） | PASS |
| 卸载清理 | 单测 `卸载时断开观察器`（disconnect）+ composable `onScopeDispose` 移除 scroll/resize/hashchange/popstate 监听与 rAF | PASS |
| 无 IntersectionObserver 降级 | 单测 `无 IntersectionObserver 的环境降级为 scroll 驱动且可用` | PASS |
| 遮挡线 rootMargin 契约 | 单测断言 `rootMargin === '-88px 0px -55% 0px'`；headerOffset 变化重建观察器 | PASS |
| 窄屏 aria-current | 与桌面同一 `#site-nav` 标记与同一 CSS，自动生效（无单独用例；navigation.spec 既有窄屏用例全绿未受影响） | PASS（结构性） |

## 测试命令与结果

```
npm run typecheck   → 仅 src/bootstrap/theme-bootstrap.ts(47,15) TS7006（T7 并行文件；我的文件零错误）
npm run test:unit   → 101 passed / 2 failed，失败 2 项均为 tests/unit/theme-bootstrap.test.ts（T7 并行中）
                      本任务 useSectionSpy.test.ts 11/11 通过；改动前的全量基线 7 文件 85 项全绿
npm run test:e2e    → 34 passed (8.7s)：
                      home 5 + navigation 10 + visual 10 + preload 4（T6 新增）+ section-spy 5
```

## 遗留与并行任务说明

1. **typecheck 1 错误、单测 2 失败均属 T7**（`src/bootstrap/theme-bootstrap.ts` + `tests/unit/theme-bootstrap.test.ts`，运行中持续变化）。按"不碰 main.ts/字体相关文件"的边界未代改。本任务文件在其之前与之后的 vue-tsc 均零错误。
2. **并行干扰记录**：一次全量 e2e 中途构建失败（`renderHeroPreload is not defined`，T6/T7 正在改 vite.config/scripts）；等待 90 秒重试后由并行任务自行修复，最终全量 34/34 绿。未动 preload.spec（T6 域）。
3. e2e 前按预案检查 4173：仅 TIME_WAIT 残留、无 LISTENING，未阻塞。
4. 视觉指示的像素级效果未做 e2e 断言（伪元素样式断言脆弱）；将由 visual.spec 截图（已在跑，10/10 绿）与人工审阅确认。

## 报告契约核对

- 修改：Header.vue、App.vue；新增：useSectionSpy.ts、section-spy.spec.ts（另加 useSectionSpy.test.ts 覆盖"缺章节"契约层验证）✓
- RED 输出：.generated/t5-red-output.txt ✓
- 选择规则、逐项验证、命令与输出、遗留：见上文 ✓
