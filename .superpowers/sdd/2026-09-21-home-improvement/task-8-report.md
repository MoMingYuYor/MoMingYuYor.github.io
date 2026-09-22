# Task 8 报告：构建拦截与发布验证入口（T8，四阶段收尾）

日期：2026-09-21　执行：T8 实现工程师（串行，无子代理）
需求：`task-8-brief.md`（方案 6.3/6.4 + 实施计划 T8 + 前序转来 6 项收尾），逐条落实。

## 结论

- **`npm run verify` 全链通过**：7 步全部退出码 0（内容检查 → 类型检查 → 单测 → 构建 → E2E → 子路径构建 → 子路径冒烟）。
- 测试净增：单测 **112 → 123**（+9 checkAssets 五类输入、+2 字符清单往返），e2e **34 → 38**（+4 failures 窄屏/图片失败/hero 失败/无脚本）。原有测试零删除零削弱。
- 视觉截图改为有基线的硬断言：**40 张基线入库 `.generated/visual-baseline/baseline/`**，34 张与 T3 after 对照图逐字节相同，6 张亚像素差异逐张目检等效后定稿。
- 慢网回退证据链修复完成，根因是 **Playwright `page.screenshot()` 内部等待 web 字体就绪**（实测阻塞 2.7s），结构上拍不到 swap 窗口；改用原生 CDP `Page.captureScreenshot` 抓帧后 mid/loaded md5 互异、状态断言入 JSON。
- 杂散 `#` 修复：字符清单 **356 → 355**，子集 600/700 分别 **72,408→72,260 B / 74,408→74,236 B**（合计 -320 B）。
- 字体链路接入 `build`：`check:content → fonts:build → vite build`；`fonts:build` 缓存命中秒级跳过（verify 实测两次打印"跳过子集化"）。

## 改动文件

新增：
- `scripts/check-assets.ts`：`checkLocalAssets(content, publicRoot)` + `collectAssetRefs`，返回带字段路径的问题数组（复用 `ContentIssue` 形状）
- `scripts/verify.ts`：统一验证入口（串行 7 步、任一步失败以对应码退出、单测步 60s 限时并终止进程树、4173 端口预检、子路径冒烟）
- `scripts/run-fonts-subset.mjs`：`fonts:subset` 跨平台包装（npm/cmd 无法直接执行正斜杠 venv 路径；venv 缺失时给明确创建指引，计划交付清单外的必要新增）
- `tests/unit/check-assets.test.ts`：9 用例（os.tmpdir 临时目录自建 public 根，测试内创建/清理）
- `tests/e2e/failures.spec.ts`：4 用例（320px 画廊交互与横向溢出、画廊图片失败降级、hero 失败正文可读、无脚本最小说明）

修改：
- `scripts/prepare-site.ts`：`ensureSiteMeta` 接入 `checkLocalAssets`（项目根 `public/` 为 publicRoot；结构问题与资源问题合并报告）
- `vite.config.ts`：改函数式读取 `SITE_BASE ?? '/'` 接入 Vite base；启动时字体子集缺失给"先跑 fonts:build"指引（dev 不强制重建）
- `package.json`：`build` 改为 `npm run check:content && npm run fonts:build && vite build`；新增 `verify`；`fonts:subset` 经 `run-fonts-subset.mjs` 调用
- `playwright.config.ts`：`snapshotPathTemplate` 指向 `.generated/visual-baseline/baseline/{arg}{ext}`；注释明确 CI（及 verify 以 CI=1 调用）不复用已有服务
- `tests/e2e/visual.spec.ts`：`page.screenshot` 产出 → `toHaveScreenshot` 基线断言；`settleSection` 追加双 rAF；仅 768/1024 dark interests 两张启用 `maxDiffPixelRatio: 0.02`
- `tests/components/gallery.spec.ts`：多项 aria-controls 用例补 `expect(panel?.getAttribute('aria-labelledby')).toBe(tab.attributes('id'))`
- `scripts/collect-font-chars.ts`：删除裸 `'#'` 分隔行（会被解析为字符负载混入 U+0023）
- `scripts/prepare-fonts.py`：缓存键纳入子集化选项（`build_options()` 抽取 + `subset_options_tag()`），改选项自动重建，不再需要手删缓存
- `.generated/font-baseline/slow-network-check.mjs`：CDP 抓帧 + loading 断言 + JSON 证据（重录）
- `README.md`：真实运行方法、字体重建、演示内容替换指引、已验证/未验证平台

（说明：计划交付清单未列 `scripts/run-fonts-subset.mjs`，为满足"venv 不存在时明确报错与指引"且兼容 npm/cmd 的必要新增。）

## checkAssets 五类输入的测试证据（测试先行）

RED：实现前运行 `tests/unit/check-assets.test.ts` 失败（模块不存在，exit=1），证据 `.generated/t8-red-output.txt`。GREEN：9/9 通过。

| 类别 | 用例 | 断言要点 | 结果 |
| --- | --- | --- | --- |
| 合法资源 + HTTPS | 全字段指向存在的 `images/ok.webp`、audio 存在、candidates 含 https 远程 | 返回 `[]`；https 不发构建期请求（构造上跳过，无网络调用） | ✅ |
| 缺图 | `images/missing.webp`；mobileSrc/candidates 变体；多字段同时缺失 | `hero.dark.src`/`hero.dark.mobileSrc`/`hero.dark.candidates[1].src` 等字段路径 + "缺失" | ✅ |
| 路径指向目录 | `images/dir.webp` 为目录 | 报告"指向目录而非文件"，不误报缺失 | ✅ |
| 越界 | ① `images/../../outside.webp`（目标真实存在于根外）② 符号链接 `link.webp → 根外文件`（realpath 复核）③ 绝对路径键（根外/根内各一） | ①③ "越出 public 根目录"；② "符号链接目标越出"；绝对键即使指向 public 内也拒绝（相对资源键契约） | ✅（symlink 用例在拒绝创建符号链接的环境自动 skip，本机管理员权限下实际执行） |
| publicRoot 错误 | 根目录不存在 | 在 `publicRoot` 字段报告配置错误 | ✅ |

接入点：`ensureSiteMeta()` 同时跑 `validateSiteContent`（纯结构）与 `checkLocalAssets`（Node fs），问题合并抛出阻断构建；vite dev/transformIndexHtml 与 CLI（`npm run check:content`）同一关口。远程 HTTPS 不发网络请求，链接核验保留人工；本检查不替代媒体授权核查。

## verify 全链输出（最终运行）

`npm run verify`，退出码 **0**，日志 `.generated/t8-verify-full.log`：

```
1/7 check:content: 0
2/7 typecheck: 0
3/7 test:unit: 0        （Test Files 12 passed / Tests 123 passed）
4/7 build: 0            （check:content + fonts:build[缓存跳过] + vite build）
5/7 test:e2e: 0         （38 passed，CI=1 强制新起本次构建的预览服务）
6/7 subpath build: 0    （SITE_BASE=/personal/ → .generated/subpath-dist，不覆盖 dist）
7/7 subpath smoke: 0    （index.html 全部本地引用带 /personal/ 前缀）
verify 全链通过。
```

- 单测步限时 60s，超时以 `taskkill /T /F`（Windows）/进程组信号（POSIX）终止整个进程树，退出码 124。
- E2E 前预检 4173 端口（TCP 连接探测），占用时报错退出且不启动 Playwright。
- **SITE_BASE 选择说明**：verify 子路径步设置环境变量 `SITE_BASE=/personal/`（非 CLI `--base`），环境变量可穿透 `npm run build` 整链（check:content/fonts:build/vite build），且 vite.config 以 `process.env.SITE_BASE ?? '/'` 统一读取；CLI `--base` 仍等效可用。子路径构建经 `npm run build -- --outDir=.generated/subpath-dist --emptyOutDir` 串行执行，与普通构建不并发写。
- 已知环境注意：Git Bash 手工执行 `SITE_BASE=/personal/ …` 时 MSYS 会把值改写为 `C:/Program Files/Git/personal/`，需 `MSYS2_ENV_CONV_EXCL=SITE_BASE` 前缀；verify.ts 以 Node spawn 传递 env 不经过 MSYS，不受影响。

### 子路径构建与冒烟结果

`.generated/subpath-dist/index.html` 实测引用：`/personal/favicon.svg`、`/personal/assets/index-*.js`、`/personal/assets/index-*.css`；无 `="/assets/`、`="/favicon` 等未带前缀引用（冒烟逻辑：所有以 `/` 开头的 src/href 必须以发布 base 开头，且存在 base 前缀的构建资源）。noscript 联系入口为 https 远程地址，不参与 base 拼接（正确）。

## 转来 6 项收尾的完成证据

1. **字体链路接入 build**：`build` = `check:content && fonts:build && vite build`；`fonts:subset` 经 `run-fonts-subset.mjs`，venv Python 缺失时退出 1 并打印创建指引（cd tools/fonts && python -m venv .venv + pip install -r requirements.txt）；venv 存在但误用全局 Python 时由 `prepare-fonts.py` 的 `ensure_venv()` 守卫。缓存命中跳过已在 verify 与手工复跑中各实测一次（打印"跳过子集化（缓存键 3c68cae3bce7…）"）。dev 不强制：vite.config 启动时检测 `src/assets/fonts/noto-serif-sc-{600,700}.woff2`，缺失抛出"先跑 fonts:build"指引。
2. **gallery.spec 补断言**：多项 aria-controls 用例循环内新增 `expect(panel?.getAttribute('aria-labelledby')).toBe(tab.attributes('id'))`（对应面板回指标签 id）；全量单测 123/123 含此用例通过。
3. **visual.spec 基线断言**：10 用例 × 4 槽位 = 40 张 `toHaveScreenshot` 基线，`snapshotPathTemplate='.generated/visual-baseline/baseline/{arg}{ext}'`（注：本版 Playwright 1.63 无 `expect.toHaveScreenshot.snapshotPathExpr`，初版误配已更正，误产生的 `tests/e2e/visual.spec.ts-snapshots/` 已删除）。首轮 `--update-snapshots` 后与 T3 after 对照图比对：**34/40 逐字节相同**；6 张差异（1024-dark/light-hero、390-dark/light-hero、1024-dark/light-interests）逐张 Read 目检：布局、字形、字重、激活标签描边、引文排版全部一致，差异为壁纸重采样亚像素噪声，判定等效后定稿。字节稳定性处理：`settleSection` 图片解码后追加双 rAF（全部截图受益，768-dark-interests 因此达到逐字节稳定）；已知的 768/1024 dark interests 两张额外保留 `maxDiffPixelRatio: 0.02` 容差，其余 38 张严格像素比对。
4. **慢网证据重录**：`.generated/font-baseline/slow-network-check.mjs` 重写——轮询断言 `document.fonts.status === 'loading'` 后抓回退帧（抓帧后复查仍为 loading），状态、节流（2500ms）、抓帧方式与两图 md5 写入 `slow-network.json`，未捕获时自动加大到 5000ms 重试。重录中发现并修复证据链断裂的真正根因：`page.screenshot()` 内部等待字体就绪（实测阻塞 2746ms 直至 loaded，故 T7 两图 md5 相同）；改用 CDP `Page.captureScreenshot` 抓当前帧后 **mid ≠ loaded（md5 互异）**，目检回退帧：整首屏以系统衬线呈现（引文单行 vs 就绪后两行，日期数字字形不同），无方框、无布局塌陷。产物：`slow-network-fallback-mid.png` / `-loaded.png` / `slow-network.json`。
5. **杂散 '#' 修复**：`collect-font-chars.ts` 删除裸 `'#'` 分隔行；新增往返单测（以 prepare-fonts.py 相同口径解析 `buildCharListFileContent` 产物 == `buildCharList` 结果，另断言站内无 '#' 时清单不含 U+0023）。重建：字符 **356 → 355**（355 即真实站点字符数，更正 T7 报告口径），子集 **600: 72,408→72,260 B（-148）；700: 74,408→74,236 B（-172）**，缓存键随之更新并实测跳过。缓存键问题（T7 评审③）顺带修复：选项纳入缓存键。
6. **最终全量验证 + A01–A12 矩阵**：见上节与下表。

## A01–A12 验收矩阵结果表

| 项 | 条件 | 结果 | 证据 |
| --- | --- | --- | --- |
| A01 | 320–1440px × 双主题控件 bounding box | **通过** | navigation.spec「关键控件在全部断点与双主题下完整落在视口内」「320px 菜单完整可见」「320px 容器两侧留白 16px」（38/38 内） |
| A02 | 菜单/主题面板键盘契约 | **通过** | navigation.spec Enter/Tab/Escape/同异锚点/焦点回落/历史不污染等 10 例 |
| A03 | 画廊 0/1/多项、删除当前项、图片失败 | **通过** | gallery.spec 组件 15 例 + gallery 纯函数 20 例 + failures.spec 图片失败降级 |
| A04 | 长标题/中文姓名/手机短屏/**真实 200% 缩放** | **部分** | 手机短屏（320/390）与窄屏画廊 e2e 通过；**真实 200% 浏览器缩放未验证**（deviceScaleFactor 仅像素密度，scripts/screenshot.mjs 已更正表述并更名 dpr2） |
| A05 | 项目展开/折叠、切项目、切主题 | **通过** | project-details.spec 8 例（含主题切换不重置展开状态与焦点）+ visual projects-details 基线 |
| A06 | 手动滚动/初始 hash/前进后退/页尾 | **通过** | section-spy.spec 5 例（aria-current、hash/历史/焦点不被污染）+ navigation.spec hash 用例 |
| A07 | 系统+保存偏好组合、preload 一致 | **通过** | preload.spec 4 例（真实请求断言）+ theme 单测 12 例 |
| A08 | 快速切换、存储拒绝、图片慢响应/失败 | **部分** | 存储拒绝降级（theme 单测）、图片失败正文可读（failures.spec hero/画廊）通过；**图片"慢响应后成功"未单独构造**（失败路径已覆盖，慢成功路径未验证） |
| A09 | 缺图/越界构建失败、HTTPS 不拼接、子路径部署 | **通过** | checkAssets 9 单测 + ensureSiteMeta 关口（check:content exit 0/失败即阻断面）+ 子路径构建冒烟（引用全部带 /personal/ 前缀） |
| A10 | 冷缓存整页字体传输、慢字体回退 | **通过** | measure-fonts before/after JSON（489,820B/13 请求 → 146,816B/2 请求，-70.0%）+ 慢网回退帧（本报告转来项 4）；清单 355 字符 cmap 全量校验无缺字 |
| A11 | 固定日期主题、字体图片解码后基线 | **通过** | visual.spec 40 张基线断言 + 首轮逐张人工比对记录（本报告转来项 3） |
| A12 | 减少动态效果、无 JavaScript | **通过** | visual.spec `reducedMotion: 'reduce'` 全基线 + failures.spec 无脚本用例（noscript 标题/说明/https 联系链接可见） |

未验证清单（如实标注）：Safari、Firefox、真实 200% 浏览器缩放、真机触屏、图片慢响应后成功路径、LCP/CLS/INP 真实用户指标（需部署后实测）。README 已同步披露。

## README 变更摘要

- 状态更新为"改造已实施完成并通过 verify"；删除"改造代码尚未执行"的过时表述。
- 本地开发命令补齐 `verify`（注释七步串联与失败语义）、`build` 的字体准备链、`dev` 字体缺失提示。
- 新增「字体子集」节：`fonts:build` 用法、355 字符/体积现状、venv 创建指引、字体源与许可位置。
- 新增「替换演示内容」节：指向 `src/content/site.ts` 与 `src/types/content.ts`，三步流程（改内容 → fonts:build → verify，视觉基线人工审阅更新）。
- 新增「已验证与尚未验证的平台与指标」节：Chrome/Chromium 38 e2e + 123 单测、40 基线、子路径与慢网已验证；Safari/Firefox/真实缩放/真机/LCP-CLS-INP/链接授权人工核验明确标注未验证。

## 遗留与关注点

1. **e2e webServer 重复构建**：verify 第 4 步构建后，第 5 步 webServer 命令（`npm run build && npm run preview`）会再构建一次（约 +10s），换取"测到的必是本次构建产物"的强保证；如需提速可改为检测 dist 新鲜度，属可选优化。
2. **MSYS 环境变量改写**：Git Bash 手工传 `SITE_BASE=/personal/` 会被路径转换，需 `MSYS2_ENV_CONV_EXCL=SITE_BASE`；CI/Linux 无此问题（README 未展开，报告记录备查）。
3. **checkAssets 的 symlink 用例**在无符号链接权限的环境自动 skip（本机已实际执行并通过）；严格 CI 需保证以管理员/特权容器运行才能持续覆盖该分支。
4. **visual 基线的两张 0.02 容差**是已知亚像素动画噪声的务实容差；若未来布局真回归发生在两像素以内，会被该容差掩盖，更新基线时仍须人工审阅。
5. 慢网回退帧中 hero 壁纸偶见未解码完成（抓帧时机在 swap 窗口内尽早执行），字体回退证据（字面度量差异、无方框）不受影响。
6. 评审 triage 历史低级别项（T1 abort 定时器未清理、T5 headerOffset 硬编码等）仍以 progress.md 记录为准，未在本任务范围内改动。
