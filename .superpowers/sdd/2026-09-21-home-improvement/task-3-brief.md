# Task 3 Brief：精修首屏与画廊可读性

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第二阶段（视觉精修）。

## 需求原文（技术方案 §4 + 实施计划 T3，逐条落实）

### 背景问题

R03：手机浅色首屏全域遮罩较厚，画面层次偏平 → 改造目标：局部保护文字，保留风景与日期面板层次。
R04：1024px 时画廊标题空间约 79px → 改造目标：标题至少有合理两行空间，图片不挤占阅读。

### 视觉参数表（首轮实现起点，真实页面对比度和构图验收优先，不得把建议参数当作测量结果）

| 元素 | 桌面 | 手机或窄屏 |
| --- | --- | --- |
| 首屏遮罩 | 保持左侧局部渐变，避开风景主体 | 按文字组区域提供柔和局部底，不再从顶部到底部统一增白 |
| 浅色遮罩起点 | 文字后方约 65%–82% 暖白；向外渐隐 | 文字后方约 72%–88%，画面空白区域尽量低于 20%，视实测调整 |
| 日期面板 | 保留玻璃层次，建议宽 280–340px | 内边距 18–20px、日期 32–36px，优先压缩空白，不裁切正文 |
| 首屏名称 | 保留衬线与强层级，按姓名长度适配 | 40–48px 起点，长名称允许换行 |
| 图库选择器缩略图 | 64–80px 宽 | 兴趣变为文字主题条；作品使用 48–64px 缩略图 |
| 图库条目标题 | 允许两行，避免全部单行省略 | 点击前可辨认主题或作品名，完整标题在主内容区显示 |
| 章节间距 | 80–112px | 48–64px；避免日期、引文、空白连续占屏 |

移动端在图片、日期面板与文字之间重新平衡空间。日期面板不设置固定最大高度，长内容自然增高；其引用可折叠于有明确展开操作的区域，不直接删除用户内容。首屏可增加一个可访问的向下浏览入口，目标是下一个实际存在的章节；减少动画偏好下直接跳转。

深浅模式使用同一字号和布局结构，分别调整遮罩与材质。深色不能仅靠降低整个页面亮度，浅色不能仅靠全域白膜。普通文字目标 4.5:1，大字目标 3:1；透明层必须用实际背景验收。

### 实施计划 T3

输入：技术方案第 4 节视觉参数与现有双主题。输出：手机局部遮罩、紧凑日期面板、两行图库标题和五档视口截图。

- 保存改造前首屏与画廊截图，标明视口、主题和日期。
- 将手机遮罩从全域渐白改为文字组局部渐变；日期面板减少间距、不裁切文字；标题空间允许两行。
- 先完成深浅 390px，再检查 320/768/1024/1440px 及长文本，不通过整体缩小字号解决溢出。
- 新建视觉测试，固定本地日期、减少动画并等待字体与实际可见图片解码后拍摄；人工确认后建立基线。

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

运行：`npm run test:e2e -- tests/e2e/visual.spec.ts`。首次基线建立后由控制器人工审阅截图（Ruling：控制器 Read 审阅代替人工审阅）。检查 A01、A04、A11；真实 200% 浏览器缩放不在本任务内（T8 记录）。

注意："兴趣变为文字主题条；作品使用 48–64px 缩略图"属于 T4（展示变体 variant）的范围，本任务不做 variant，只做：缩略图 64–80px 宽（当前 104px，按参数表桌面行调整为 64–80）、条目标题两行、间距与遮罩与日期面板。"向下浏览入口"为可选项（"可增加"），如实现需满足可访问性（可聚焦、aria-label、目标是下一个实际存在章节、reduced-motion 直接跳转）；时间紧可不做并在报告说明。

## 顺带修复项（T2 评审转来的两个 Minor，随本任务视觉精修一并处理）

1. tests/components/gallery.spec.ts 多项 `aria-controls` 用例补一行断言：面板的 `aria-labelledby` 回指对应 tab id（`expect(panel?.getAttribute('aria-labelledby')).toBe(tabId)`）。
2. `.gallery-tab-thumb-fallback`（带 1px var(--border)）与正常态缩略图 img（无边框）的视觉差异在精修中统一。

## 当前代码事实

- `src/components/Hero.vue`：`.hero-veil` 用 `var(--hero-veil)`（桌面横向渐变），≤1023px 媒体查询里覆盖为 `var(--hero-veil-narrow)`（全域纵向渐白——就是要改掉的对象）。hero 面板 `.hero-panel` padding 28px、日期 clamp(2.25rem,4vw,3rem)。姓名 clamp(2.5rem,7vw,6rem)。左下角 footnote（装饰，窄屏隐藏）。
- `src/styles/tokens.css`：`--hero-veil`（浅/暗两组）与 `--hero-veil-narrow`（浅/暗两组，另有无 JS 媒体查询兜底组，共三处定义——改时三处同步或重构为窄屏引用桌面 token 的组合）。
- `src/components/GallerySection.vue`：T2 刚改过——主图 figure 已在面板内部；缩略图当前 104x68；`.gallery-tab-name` 单行省略；章节间距来自 global.css `.section-block { padding-block: clamp(4rem, 10vw, 7rem) }`。
- `src/styles/global.css`：`.section-block`、`.section-head` 等。
- 跑 e2e 前先确认 4173 端口无残留进程（`netstat -ano | grep 4173`，有则 taskkill），否则 Playwright 会复用旧构建（T1 经验）。

## 全局约束

- 深浅主题同等完整；640/1024 主要断点；验证 320/390/768/1024/1440px。
- 不删除现有测试；e2e home.spec 5 例 + navigation.spec 10 例保持通过；单测 65 项保持通过。
- 现有 `prefers-reduced-motion` 全局规则不得破坏。
- 视觉基线截图保存到 `.generated/visual-baseline/`（before 与 after 分目录，文件名含视口/主题/日期）。

## 交付与报告契约

- 修改：src/components/Hero.vue、src/components/GallerySection.vue、src/styles/tokens.css、src/styles/global.css；新增：tests/e2e/visual.spec.ts。
- 禁止派发任何子代理；禁止修改清单外文件（如必须，报 BLOCKED）。
- 先拍 before 截图（390 深浅 + 1440 深浅 首屏与画廊），再改样式，再拍 after，全部入 .generated/visual-baseline/。
- 完整报告写入 .superpowers/sdd/2026-09-21-home-improvement/task-3-report.md：改动文件、每个视觉参数的落点（改了什么值、在哪）、截图路径清单、测试命令与结果、遗留。
- 最终回复：状态 / 改动文件 / 一行测试结论 / 关注点。
