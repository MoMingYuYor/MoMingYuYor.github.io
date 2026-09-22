# 个人主页设计资料

本项目采用沉浸式风景首屏与分章节画廊展示，提供深浅两种完整视觉模式。首版网站已按下列文档实现（Vue 3 + TypeScript + Vite），页面内容与媒体均为明确标注的演示占位，待真实资料替换。

2026-09-21 的四阶段改造（组件行为、视觉参数、加载策略、字体裁剪与验证链）已实施完成并通过全链验证（`npm run verify`），前三份文档保留为首版基线，新方案仅覆盖其中明确列出的改造项。

建议按下列顺序阅读：

1. [总体风格设计](./docs/01-总体风格设计.md)：查看深浅效果稿、布局、配色、字体、动效和响应式规则。
2. [项目设计方案](./docs/02-项目设计方案.md)：了解页面内容、首版范围、模块划分、技术选型和阶段交付。
3. [实现手段与具体细节](./docs/03-实现手段与具体细节.md)：依据内容模型、主题与画廊行为、文件职责和验收矩阵开展开发。
4. [体验提升与工程加固技术方案](./docs/04-体验提升与工程加固技术方案.md)：已批准的四阶段改造，包含组件行为、视觉参数、加载策略和 A01–A12 验收矩阵。
5. [四阶段改造实施计划](./docs/superpowers/plans/2026-09-21-home-improvement.md)：T1–T8 文件责任、接口、执行步骤、回归示例和交付要求。

视觉基准为 [深色概念稿](./docs/assets/home-dark-concept.png) 与 [浅色概念稿](./docs/assets/home-light-concept.png)。姓名、图片、项目与文字均为演示占位，后续替换为用户提供的内容。

## 本地开发

```sh
npm install          # 安装依赖（版本以 package-lock.json 为准，锁定文件存在时优先 npm ci）

npm run dev          # 本地开发服务器（含内容校验；字体子集缺失时提示先跑 fonts:build）
npm run build        # 内容校验 + 字体子集（缓存命中则秒级跳过）+ 生产构建到 dist
npm run preview      # 预览构建产物

npm run check:content   # 内容结构校验 + 本地媒体资源文件系统检查（缺图/指向目录/越界/符号链接逃逸即失败）
npm run typecheck       # 类型检查（vue-tsc + tsc）
npm run test:unit       # Vitest 单元与组件测试
npm run test:e2e        # Playwright 端到端检查（使用系统 Chrome；本地运行会复用已在 4173 端口的服务）

npm run verify       # 统一验证入口：check:content → typecheck → test:unit → build → test:e2e
                     # → SITE_BASE=/personal/ 子路径构建（输出 .generated/subpath-dist）→ 资源前缀冒烟
                     # 任一步非零退出立即终止；发布前必须跑通本命令
```

### 字体子集（内容变更后必须重建）

站点使用 Noto Serif SC 600/700 两档子集（当前 355 个字符，单字重约 72/74 KB）。页面文字变更后运行：

```sh
npm run fonts:build   # = fonts:collect（收集字符清单）+ fonts:subset（fontTools 子集化，hash 缓存）
```

子集化依赖项目隔离 Python 环境 `tools/fonts/.venv`，不存在时脚本会报错并给出创建指引：

```sh
cd tools/fonts && python -m venv .venv
tools/fonts/.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt
```

字体源（OFL 许可）与重建说明见 `assets/fonts-source/sources.md`；字符清单组成见 `scripts/collect-font-chars.ts` 头部注释。

### 替换演示内容

站点内容单一来源是 `src/content/site.ts`：姓名、头像、首屏文案、兴趣与项目条目、关于段落、联系入口、SEO 元数据都在其中，字段契约见 `src/types/content.ts`。替换指引：

1. 修改 `src/content/site.ts`（图片放到 `public/images/`，资源键写相对路径如 `images/xxx.webp`，或使用 https 远程地址；演示状态 `status: 'demo'` 不允许开放索引，正式发布前核验链接并转 `'ready'`）。
2. 运行 `npm run fonts:build` 重建字体子集（新文字的字形自动纳入；缺失字形会在 cmap 校验时报错）。
3. 运行 `npm run verify` 全链验证；视觉基线变化时用 `npx playwright test tests/e2e/visual.spec.ts --update-snapshots` 更新基线并逐张人工审阅。

## 已验证与尚未验证的平台与指标

已验证（2026-09-21，`npm run verify` 全链退出码 0）：

- Chromium 内核（系统 Chrome，Playwright Desktop Chrome 档）：38 例端到端、123 项单元/组件测试。
- 桌面 1440/1024/768 与移动 390/320 宽度、深浅两主题的 40 张视觉基线断言。
- `/personal/` 子路径构建与资源前缀冒烟；慢网（woff2 延迟 2.5s）字体回退帧。
- 字体传输量：冷缓存整页浏览 2 个请求 146,816 B（改造前 13 个 489,820 B）。

尚未验证（如实标注，结果缺失不代表不达标）：

- Safari 与 Firefox：未执行（本环境 Playwright CDN 不可达，仅系统 Chrome 可用）。
- 真实 200% 浏览器缩放与真机触屏：未执行（`deviceScaleFactor` 只是像素密度，不能替代）。
- LCP / CLS / INP 等真实用户指标：需部署后按文档 03 的设备与网络条件实测；INP 需要线上真实用户数据。
- 演示内容的链接可达性与媒体授权：构建检查不做网络请求，发布前须人工核验。

文档中的技术栈和数值参数属于当前工程方案，版本以 `package-lock.json` 锁定记录为准。性能及可访问性指标是待持续验证目标：类型检查、内容校验、单元测试、构建与端到端检查已随改造运行通过，真实用户指标仍需部署后按文档条件实测。
