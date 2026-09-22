# Task 8 Brief：构建拦截与发布验证入口

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造的最后汇总任务：严格资源检查、统一验证入口、移动/异常回归与发布记录。T1–T7 已全部完成并通过任务评审，你负责把所有结果串成一条可执行的发布验证链。

## 需求原文（技术方案 6.3/6.4 + 实施计划 T8，逐条落实）

### 技术方案 6.3 本地媒体与路径检查

新增构建侧 `scripts/check-assets.ts`，遍历身份头像、两种首屏图及移动图、候选图、兴趣、作品、关于、分享图和可选音频。对站点资源 key，先校验规范化路径不越出 public，再检查目标存在且为文件；失败报告完整字段路径并以非零状态阻断构建。远程 HTTPS 不在构建时发网络请求，保留人工链接核验；不得以构建检查代替媒体授权核查。

静态文件系统检查与 `validateSiteContent` 的纯结构校验分离。分享图和无脚本联系入口继续服从 demo/ready 的公开规则。发布 base 由明确的 `SITE_BASE` 提供，默认 `/`；验证根路径和 `/personal/`。已有锁文件使用 `npm ci`，不得在改造过程中无依据升级核心依赖。

### 技术方案 6.4 统一验证入口

增加 `verify` 串联内容检查、类型检查、单元与组件测试、构建和 E2E。构建保持可单独执行，发布流程必须调用 verify。E2E 在独立端口启动本次构建的预览，CI 不复用已有服务，避免测到旧产物。子路径验收使用独立输出目录或在普通验证完成后串行执行，不同时覆盖 dist。

保留现有纯函数测试；组件测试已具备（@vue/test-utils + happy-dom）。桌面浏览器测试继续使用已安装 Chrome；Safari/Firefox/真机结果缺失时如实标注。

### 实施计划 T8

- 在临时测试目录构造"缺图""文件路径指向目录""越界""合法资源""HTTPS"五类输入，先写失败用例。
- 实现 `checkLocalAssets(content, publicRoot)`，返回带字段路径的问题数组；用 `realpath` 检查符号链接目标也不能逃离根目录，非 HTTPS 本地项必须实际存在。
- 将检查接入 `ensureSiteMeta`，`SITE_BASE` 接入 Vite base；移除截图脚本把像素密度称为 200% 缩放的说明（全库 grep "200%" / "deviceScaleFactor"，tests/ 与 scripts/ 内如有一律更正为如实表述）。
- 新增 `scripts/verify.ts` 串行执行检查，任一步失败即非零退出；单测进程初始限时 60 秒，超时实际终止进程树。普通构建与子路径构建不得并发写 dist。
- Playwright 增加窄屏和失败场景，CI 使用本次构建的新服务；将视觉截图改为有基线的断言。
- 回归原有测试、整页浏览、无脚本和减少动态效果，更新 README 的真实运行方法与尚未验证的平台。

计划提供的脚本入口：

```json
{
  "verify": "tsx scripts/verify.ts",
  "test:unit": "vitest run",
  "test:e2e": "playwright test"
}
```

verify 顺序为 `check:content → typecheck → test:unit → build → test:e2e`，再串行执行 `/personal/` 构建与资源冒烟；子路径产物建议输出 `.generated/subpath-dist`。字体准备在 build/dev 准备链中显式执行。验证脚本不负责安装或升级依赖。

## 前序任务转来的收尾项（本任务必须完成）

1. **字体构建链路接入**（T7 交付了手动脚本，接入方式见其报告 task-7-report.md 末节）：把 `fonts:collect + fonts:subset`（依赖 tools/fonts/.venv）挂入 build/dev 准备链——建议 `build` 脚本改为 `npm run check:content && npm run fonts:build && vite build`（或等效），dev 不强制（字体文件已在 src/assets/fonts/，dev 缺失时报错提示先跑 fonts:build 即可）。缓存存在时重复执行应秒级跳过（T7 已实现 hash 缓存）。venv 不存在时给出明确报错与安装指引，不静默跳过。
2. **gallery.spec.ts 补一行断言**（T2 评审转来，T3 因并行约束 BLOCKED）：多项 `aria-controls` 用例补 `expect(panel?.getAttribute('aria-labelledby')).toBe(tabId)`（对应面板 id）。
3. **visual.spec 字节稳定性**（T3 评审转来）：`768-dark-interests` 与 `1024-dark-interests` 跨运行字节不稳定——settleSection 后加双 rAF 等待或对截图引入 `maxDiffPixelRatio` 容差；同时按计划把视觉截图改为有基线的断言（`toHaveScreenshot` + 基线入库 .generated/visual-baseline/baseline/，首轮 `--update-snapshots` 由你执行并逐张确认与 after 基线等效）。
4. **T7 慢网证据补录**：重录慢网回退证据——脚本断言 `midStatus === 'loading'` 后再截图、状态写入 JSON；不满足时延长节流或缩短前置等待。产物更新 .generated/font-baseline/。
5. **T7 杂散 '#' 修复**：collect-font-chars.ts 分隔行改为 `'# '`（或删除分隔行）；补"清单文件往返解析 == buildCharList 结果"单测；重新生成清单与子集（应减少 1 个字形，体积略降）；缓存键问题（低）顺带修或注释明示。
6. **最终全量验证**：`npm run verify` 全链通过；A01–A12 验收矩阵结果表（写入报告，逐项标 通过/部分/未验证——未执行的 Safari/Firefox/真实 200% 缩放/真机明确标未验证）。

## 当前代码事实

- `scripts/prepare-site.ts`：ensureSiteMeta()（validateSiteContent 关口 + persistMetaFile）被 vite.config transformIndexHtml 与 CLI 直接调用——checkLocalAssets 接入点放这里（注意保持"无 DOM 无网络"纯 Node 语义；文件系统检查是 Node fs，不违反）。
- `vite.config.ts`：inject-site-meta 插件（configResolved 记 base、async transformIndexHtml 注入 meta/noscript/theme-bootstrap）；test.include（unit+components）。SITE_BASE 接 base：`defineConfig(({ mode }) => ...)` 读 `process.env.SITE_BASE ?? '/'`。
- 测试现状：单测 104 项（theme 12/assets 5/content 14/gallery 纯函数 20/组件 gallery 15/useSectionSpy 11/font-chars 9/serialize-inline+hero-source+theme-bootstrap 等）；e2e 34 例（home 5/navigation 10/visual 10/preload 4/section-spy 5）。playwright.config.ts webServer 端口 4173。
- T7 交付：package.json 有 fonts:collect/fonts:subset/fonts:build；tools/fonts/.venv 就绪；src/assets/fonts/ 2 个 woff2。
- README.md 当前描述的是改造前状态（未提 verify、字体、新测试），需更新。

## 全局约束

- 不升级核心依赖（vue/vite/vitest/playwright 版本不动）；新增依赖如必需（如即可，尽量零新增）。
- 不得删除或削弱现有任何测试；新增测试净增。
- verify 任一步失败非零退出；子路径构建输出 .generated/subpath-dist，不覆盖 dist。
- e2e 4173 端口冲突：跑之前 netstat 检查。
- 禁止派发任何子代理；T4 已完成（其改动已收敛），动手前读 GallerySection.vue/InterestGallery/ProjectGallery 最新版。

## 交付与报告契约

- 新增：scripts/check-assets.ts、scripts/verify.ts、tests/unit/check-assets.test.ts、tests/e2e/failures.spec.ts；修改：scripts/prepare-site.ts、vite.config.ts、package.json、playwright.config.ts（如需）、tests/e2e/visual.spec.ts、tests/components/gallery.spec.ts（一行断言）、scripts/collect-font-chars.ts（'# ' 修复）、README.md。
- 测试先行：check-assets 五类失败用例先写并确认当前无检查时失败，再实现。
- 完整报告写入 task-8-report.md：改动文件、checkAssets 五类输入的测试证据、verify 全链输出（各步退出码）、子路径构建与冒烟结果、A01–A12 逐项结果表（含未验证标注）、转来 6 项收尾的完成证据、README 变更摘要、遗留。
- 最终回复：状态 / 改动文件 / verify 一行结论 / 关注点。
