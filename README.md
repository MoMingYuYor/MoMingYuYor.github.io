# MoMingYu 的个人主页

[https://momingyuyor.github.io/](https://momingyuyor.github.io/)

山湖风景首屏与分章节排版的个人主站：明暗双主题、衬线排印、无脚本也可完整阅读。
基于 Astro + TypeScript，构建产物为纯静态多页站点。

> 站点当前处于**预览阶段**：公开页面保持 `noindex`，内容为真实空状态或待补资料。
> 正式索引开放是独立的发布状态，需内容与隐私确认通过后才切换。

## 本地开发

```sh
npm install            # 安装依赖（版本以 package-lock.json 为准）
npm run dev            # 本地开发服务器
npm run build          # 生产构建到 dist
npm run preview        # 预览构建产物（单实例：同工程同时只能有一个 preview）
npm run typecheck      # astro check（类型与模板检查）
npm run test:unit      # 单元测试（Vitest，只跑 tests/unit）
npm run test:e2e       # 浏览器测试（Playwright，系统 Chrome）
npm run verify         # 发布级全量验证：类型 → 单测 → 构建 → e2e → 子路径构建 → 子路径冒烟
```

`npm run verify` 是提交前的完整门槛。它串行执行，任一步失败即非零退出，超时按进程树终止。

## 目录与职责

| 路径 | 职责 |
| --- | --- |
| `src/lib/site.ts` | 站点身份、导航、联系入口、首屏素材的**唯一来源** |
| `src/lib/paths.ts` | 站内路径与资源 URL 的唯一构造函数（统一处理子路径部署） |
| `src/lib/media.ts` | 媒体描述与派生：预载、`picture`、`srcset`、`sizes`、裁切焦点、缩略图 |
| `src/lib/theme.ts` | 主题纯规则（三态、存储键、异常降级） |
| `src/lib/datetime.ts` | 首页日期与问候的纯函数 |
| `src/styles/tokens.css` | 设计变量：颜色、字号档位、间距、断点相关的媒体查询 |
| `src/styles/global.css` | 排版基线、容器、章节头、skip-link、焦点轮廓、减少动画 |
| `src/layouts/BaseLayout.astro` | 页面骨架；每页独立标题、摘要与 canonical |
| `src/bootstrap/` + `scripts/build-theme-bootstrap.ts` | 首帧主题引导（构建期打包为内联脚本） |
| `tests/unit/` | 纯模块单元测试 |
| `tests/e2e/` | 浏览器测试（Playwright） |

内容接入点用 `data-*` 属性标记（例如首页的 `data-home-projects`），
**不用 HTML 注释**——注释会随产物发布给访客。

## 字体子集

展示用 Noto Serif SC 按**真正使用衬线的文本与字重**裁剪，子集产物入库在
`src/assets/fonts/`。常规构建只消费已入库的子集，**不需要**字体源或 Python 环境。

内容变更后需要重建子集（否则新增的标题字会出现缺字）：

```sh
npm run fonts:build    # = fonts:collect（扫描 dist 收集字符）+ fonts:subset（裁剪）
```

前置条件：

- 先跑一次 `npm run build`——字符清单以**构建产物**为准。
- `assets/fonts-source/` 下的 OFL 字体源（48MB OTF，未入库，来源与许可见该目录的 `sources.md`）。
- `tools/fonts/.venv/` 隔离环境（未入库），依赖见 `tools/fonts/requirements.txt`。

缺字会让 `fonts:subset` 直接报错退出，不会静默产出不完整的子集。
`npm run verify` 会在构建后校验产物中真正使用衬线的文字是否都被已入库子集覆盖。

## 部署

推送到 `main` 后由 GitHub Actions 构建并发布（`.github/workflows/deploy.yml`）。
工作流先跑只读的验证任务，通过后再由独立的部署任务发布**构建产物目录**，不发布仓库根目录。

## 相关文档

- 设计规格：`docs/superpowers/specs/2026-09-22-personal-brand-site-design.md`
- 实施计划：`docs/superpowers/plans/`

`docs/` 与 `.generated/` 都在 `.gitignore` 中：前者是内部设计与过程档案，后者是本地构建与验收产物。
