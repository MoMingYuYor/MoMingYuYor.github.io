# Task 3 报告：精修首屏与画廊可读性

状态：完成。R03 与 R04 均已修复并有 before/after 截图对照，两个顺带修复项完成一项、另一项因禁改清单冲突按 BLOCKED 上报，全部测试保持通过。

## 改动文件

- `src/styles/tokens.css`：移除三处 `--hero-veil-narrow`（浅色、`[data-theme='dark']`、无 JS 媒体查询兜底组），新增三处 `--hero-text-veil`；新增 `--container-pad` 供容器与首屏条带共用。
- `src/components/Hero.vue`：窄屏遮罩策略改为文字组局部条带；日期面板紧凑化；首屏名称窄屏字号独立收敛；新增可访问的向下浏览入口。
- `src/components/GallerySection.vue`：缩略图从 104x68 调整为 72x48（含模板 width/height 属性）；条目标题改两行截断；失败占位与正常缩略图观感统一。
- `src/styles/global.css`：`.section-block` 章节间距改为 `clamp(3rem, 8vw, 7rem)`；`.container` 内边距改用 `--container-pad`（数值不变）。
- `tests/e2e/visual.spec.ts`：新增，30 张对照截图的产出用例。

未触碰：`main.ts`、`Header.vue`、`App.vue`、`ThemeSwitch.vue`、`src/lib/**`、`tests/components/**`、全部既有测试。

## R03：手机首屏全域遮罩过厚

窄屏（≤1023px）原来用 `--hero-veil-narrow` 从顶部到底部统一增白（浅色 0.62–0.82），整幅画面发灰。现改为遮罩整体退场（`.hero-veil` 窄屏 `background: none`），文字可读性由 `.hero-text::before` 的全宽局部条带承担：垂直方向以 `--hero-text-veil` 两端渐隐至透明，水平方向顶满容器（`left/right: calc(-1 * var(--container-pad))`），条带边缘恰好落在视口边缘，不产生可见接缝，也不引入横向滚动。`.hero-text` 设 `position: relative; z-index: 0` 形成层叠上下文，使 `::before`（`z-index: -1`）垫在文字之下、壁纸之上，包括壁纸加载失败回退渐变的场景。

实现过程中否决了第一版径向渐变方案（椭圆半径大于垫盒导致盒缘仍有约 0.8 不透明度，after 首轮截图中呈可见矩形），改为条带后 320/390/768 三档均无硬边。固定 Header 区域不再依赖遮罩：两张壁纸顶部（浅色亮天空、深色暗天空）与 Header 文字有天然对比，Header 自身的滚动背景契约归 T5。

## R04：1024px 画廊标题空间不足

`.gallery-tab` 第一列从 104px 收窄到 72px，标题列宽度增加约 32px；`.gallery-tab-name` 从单行省略改为 brief 给定的两行截断（`display: -webkit-box` + `-webkit-line-clamp: 2`，行高 1.45）。before 中"演示兴趣…"被截断不可辨，after 中"演示兴趣 · 山野行走"两行完整可读，完整标题仍在主内容区 `.gallery-title` 显示，无 tooltip 承载唯一信息。卡片总宽 272px 不变，窄屏横滚行为不变。

## 视觉参数落点

| 参数 | 落点 |
| --- | --- |
| 首屏遮罩（桌面） | 保持 `--hero-veil` 左侧横向渐变不变（浅色起点 0.88，略高于建议带 65%–82% 上沿；桌面无 R03 记录，为控制改动幅度未动，已留待审阅） |
| 首屏遮罩（窄屏） | `--hero-veil-narrow` 全域增白取消；文字组条带浅色峰值 0.86、深色 0.80，条带外画面遮罩为 0 |
| 浅色遮罩起点 | 文字后方 0.86（建议带 72%–88% 内）；画面空白区域（条带外的天空与水面）遮罩 0，远低于 20% |
| 日期面板 | 窄屏 padding 28px→20px，分隔线 margin 20px→14px，问候行高 1.9→1.7；无固定最大高度，长内容自然增高；320px 实拍引文两行完整不裁切 |
| 日期字号 | 窄屏 `clamp(2rem, 8.5vw, 2.25rem)`：320px 32px、390px 33px、≥640px 36px，落在 32–36px |
| 首屏名称 | 桌面 `clamp(2.5rem, 7vw, 6rem)` 不变；窄屏 `clamp(2.5rem, 11vw, 3rem)`：320px 40px、390px 43px、≥640px 48px，落在 40–48px，`overflow-wrap: anywhere` 允许长名换行 |
| 图库缩略图 | 72x48（64–80px 档中点附近），`grid-template-columns` 与 img 属性同步；"文字主题条/48–64px"归 T4 variant，未做 |
| 图库条目标题 | 两行截断，行高 1.45；摘要仍单行省略 |
| 章节间距 | `clamp(3rem, 8vw, 7rem)`：390px 48px、640px 51px、768px 61px（窄屏带 48–64）；1024px 82px、1440px 112px（桌面带 80–112） |
| 向下浏览入口 | 已实现（"可增加"项）：44px 圆形锚点按钮，`:href` 指向按 `site.interests/projects/about` 依次回退的下一个实际存在章节，`aria-label="向下浏览：{章节名}"`，原生锚点跳转即满足减少动画偏好下直接跳转；仅 ≤1023px 显示 |
| 移动端引文折叠 | 当前演示引文最长 18 字，面板无固定高度自然增高、实拍不裁切，折叠区域无必要，未添加（未删除任何内容） |

深浅主题共用同一字号与布局结构，仅 `--hero-text-veil` 与玻璃材质分主题取值；未以整体降亮度或全域白膜实现。对比度以实拍验收：390 两主题的名称、导语、面板文字在截图中均清晰（正文深字/浅底、浅字/深底），精确比值待控制器审阅实拍后判定。

## 顺带修复项

1. `tests/components/gallery.spec.ts` 补 `aria-labelledby` 回指断言：BLOCKED，未执行。任务简报顺带修复项要求改该文件，但派发上下文明确"绝对不碰 tests/components/**"，且简报交付契约限定修改清单为四个源文件加新增 visual.spec，并规定"禁止修改清单外文件（如必须，报 BLOCKED）"。两处约束一致指向不改，故按契约上报；断言内容已在简报中写明（`expect(panel?.getAttribute('aria-labelledby')).toBe(tabId)`），一行即可补入，请控制器裁决归属。
2. `.gallery-tab-thumb-fallback` 与正常缩略图观感统一：已完成。移除占位的 1px `var(--border)` 边框，两者同为 72x48、4px 圆角、`var(--surface-bg)` 底、无边框；失败态信息仍由主内容区 `.media-fallback` 替代文本承担。

## 视觉测试与截图

`tests/e2e/visual.spec.ts`：`test.use({ timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })`，用例内 `page.clock.setFixedTime(new Date('2026-09-21T04:00:00Z'))`（安装的 @playwright/test 1.63 支持 clock API，面板固定为 2026-09-21 12:00 下午好），加载后 `await page.evaluate(() => document.fonts.ready)`，章节截图前滚动入视口并 `img.decode()` 等待全部图片解码，懒加载占位不会误拍成缺图。5 视口（320/390/768/1024/1440）× 2 主题 × 3 部分（hero 视口截图、interests/projects 整节截图）= 每轮 30 张。首轮不做 `toHaveScreenshot` 硬断言；输出槽位由 `VISUAL_SLOT=before|after` 切换（缺省 after），before/after 两轮同用例同构图，逐张可比。文件顶部 `/// <reference types="node" />` 为 `process.env` 提供类型（tsconfig 未含 node types，不加会挂 typecheck）。

截图目录（命名 `{视口}-{主题}-{部分}-2026-09-21.png`）：

- `.generated/visual-baseline/before/`：30 张（改造前，含 R03/R04 证据 `390-light-hero`、`1024-light-interests`）
- `.generated/visual-baseline/after/`：30 张（改造后最终版；首轮径向渐变版已被本轮条带版覆盖，中间态未留档）

## 测试命令与结果

- `npm run test:e2e`：25 通过（home 5 + navigation 10 + visual 10），既有 15 例无回归。
- `npm run test:unit`：65 通过（5 个文件）。
- `npm run typecheck`：通过。
- 每次运行前确认 4173 端口无 LISTENING 残留（仅 TIME_WAIT），预览服务器均为新构建。

## 遗留与关注点

- 顺带修复项 1 待归属（见上，一行断言）。
- 桌面浅色遮罩起点 0.88 略高于参数表建议带（65%–82%），按"建议参数不作为测量结果、真实验收优先"保留现状，请控制器在 1440 light before/after 对照中裁决。
- T7 并行接入 Noto Serif SC 后，衬线字重渲染可能与 before 基线存在字体差异（before 拍摄时尚未接入），基线审阅时请区分字体因素与样式因素。
- 真实 200% 浏览器缩放按裁决不在本任务内（T8 记录）。
