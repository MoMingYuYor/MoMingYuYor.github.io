# Task 7 Brief：字体裁剪先验证后接入

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第四阶段的字体子集任务。**前置探测已完成（控制器）**：@fontsource 包内无完整字体源；官方 notofonts/noto-cjk GitHub 仓库可下载 OTF 静态实例（600/700 两字重，OFL 许可）；Python 3.14.7 可用。

## 需求原文（技术方案 6.2 + 实施计划 T7，逐条落实）

保留 Noto Serif SC 的 600/700 视觉层级，首选按当前站点实际展示字符生成本地子集，不先以删除字重换取体积。新增 `scripts/prepare-fonts.py` 使用明确版本的 fontTools/WOFF2 能力，依赖安装于项目隔离环境，不进行全局安装；如环境无法支持，暂停这一优化任务并记录原因，不静默换字体。正式实施前先用一组当前内容验证工具能稳定输出和正确显示中文。

字符清单包含内容配置里的所有可显示文本、组件固定标签、演示文案、日期数字、星期、问候和标点。覆盖非激活项目和展开详情，不能只抓首屏 DOM。原始字体与 OFL 许可须保留；输出写入生成目录，通过内容及字体源 hash 缓存。生成的 `@font-face` 保留相应 font-weight、正确 unicode-range 与 `font-display: swap`；系统字体保底，缺字不能出现方框。每次编辑内容后重建清单；开发模式也应更新。

首轮目标是在相同字体视觉和全部文本覆盖的条件下，把冷缓存整页浏览的字体传输量降低至少 40%，即相对约 494KB 基线控制到约 296KB 内。此为待验证预算，若达不到先记录真实覆盖与体积再调整策略，不为满足数字牺牲字符或内容。页面截图要在字体加载完成后比较；另测慢网下字体回退时的布局稳定性。

### 实施计划 T7

- 先记录现有所有章节浏览的字体请求数、传输字节与截图；不把磁盘包大小当下载量。
- 验证当前包是否提供可裁剪的完整字体源；若只有分片，明确所需字体源及许可后再接入（已完成：需下载官方源，见下）。
- 在项目隔离 Python 环境核定 fontTools 与 Brotli，记录精确版本。
- 收集 site 所有可显示文本、组件固定标签、日期/星期/问候和标点；单测覆盖非激活项目和详情文本。字体 cmap 校验不得静默忽略缺失字符。
- 生成两个字重子集并保留必要字体布局和许可元信息；替换 `main.ts` 的整套分片 CSS 导入，接入内容变更重建。
- 按相同冷缓存、相同浏览流程对比资源与视觉；不达预算如实记录，不删内容或降画质凑数字。

字体源准备完成后，将两个已核验静态字重文件归档（控制器 Ruling：官方源是 OTF 静态实例，如实归档为 .otf，不转格式不冒充 TTF）：
- `assets/fonts-source/NotoSerifSC-600.otf`（下载自 https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-SemiBold.otf ）
- `assets/fonts-source/NotoSerifSC-700.otf`（ https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Bold.otf ）
- 同目录保存 OFL 许可文本与来源记录（LICENSE + README 或 sources.md）。

脚本创建 `.generated/fonts/` 和字符清单后在项目隔离 Python 环境执行（示例，按实际 .otf 文件名调整）：

```sh
python -m fontTools.subset assets/fonts-source/NotoSerifSC-600.otf --text-file=.generated/font-chars.txt --flavor=woff2 --no-ignore-missing-unicodes --output-file=.generated/fonts/noto-serif-sc-600.woff2
python -m fontTools.subset assets/fonts-source/NotoSerifSC-700.otf --text-file=.generated/font-chars.txt --flavor=woff2 --no-ignore-missing-unicodes --output-file=.generated/fonts/noto-serif-sc-700.woff2
```

emoji 等刻意由系统字体呈现的符号放入明确的回退清单，不传入衬线字体子集；正常中文字符不允许悄悄从清单中删除。生成 CSS 通过 Vite 管理资源引用，使 hash 和 base 正确。

运行：`tests/unit/font-chars.test.ts`、普通构建及字体网络检查。通过依据为 A10；体积预算是较 494KB 基线降低至少 40%，同时完整覆盖现有文本。字体源或环境不满足时，只阻塞本任务，其他阶段仍可交付。

## 控制器裁决与适配（必须遵守）

1. **@font-face 放独立文件**：新建 `src/styles/fonts.css`（由 main.ts import），**不要修改 src/styles/tokens.css**（T3 正在并行修改它）。fonts.css 里用 `url()` 引用子集字体文件——把生成好的 woff2 放到 `src/assets/fonts/`（Vite 会处理 hash 与 base），`font-display: swap`、正确的 font-weight、无需手写 unicode-range（单子集全量 unicode-range 可省略或写整体范围）。
2. **隔离 Python 环境**：在项目下建 `tools/fonts/`（venv 或 `python -m venv`），`tools/fonts/requirements.txt` 记录 fontTools 与 brotli 的精确版本；安装到该 venv，不全局安装。prepare-fonts.py 用该 venv 的 python 执行（脚本内可注明调用方式）。
3. **子集产物的构建链接入**：`.generated/fonts/*.woff2` 生成后复制到 `src/assets/fonts/`（作为源码树内资源被 Vite 引用）；`scripts/collect-font-chars.ts` 负责从 site.ts + 组件固定文案收集字符写 `.generated/font-chars.txt`。**dev/build 自动重建链路（vite.config 接入）本任务不做**——那会与 T6 的构建链改动冲突，本任务交付：手动可复现的脚本 + 使用说明（写入报告），接入由 T8 串行整合。
4. **字符清单收集方式**：静态 import `src/content/site.ts` 遍历所有字符串字段（含非激活与详情文本、contacts、about.paragraphs、hero 文案、galleries 文案）+ 组件固定标签清单（导航标签、主题控件文案"跟随系统/浅色/深色/主题偏好"、菜单 aria 文案"打开/关闭导航菜单"、面板问候 wish、星期与日期数字、标点"：，。·""/"等）。用 tsx 跑。回退清单：◐ ☀ ☾ ☰ ✕ → 等由系统/图标字体呈现的符号不进衬线子集（写入清单文件注释）。
5. **基线记录**：改 main.ts 之前，先用 playwright 记录当前冷缓存整页浏览的字体请求数与传输字节（request 事件统计 woff/woff2 响应体大小，输出存 .generated/font-baseline/before.json）；替换后同法记录 after.json 并对比。截图对比桌面首屏（字体加载完成后 document.fonts.ready）存 .generated/font-baseline/。
6. **缓存**：prepare-fonts.py 对字符清单内容 + 字体源文件做 hash，无变化跳过子集化。

## 当前代码事实

- `src/main.ts`：当前 `import '@fontsource/noto-serif-sc/600.css'` 与 `import '@fontsource/noto-serif-sc/700.css'`（101 分片/字重）。替换为 `import './styles/fonts.css'`（保留其余 import 不动）。@fontsource 包保留在 package.json 不卸载（回退保险，体积不在 bundle 内）。
- 使用衬线的字符集：姓名"姓名待补充"、headline"把喜欢的事，慢慢做成生活。"、章节标题（兴趣/作品/关于/片段等）、画廊标题（演示兴趣/项目条目名）、面板大日期数字与引文、footer 大写英文（ALL RIGHTS RESERVED 等，衬线里没有——注意 footer 是 mono 不需要）、eyebrow "PERSONAL SPACE"（mono）。实际以 collect-font-chars 收集结果为准。
- 494KB/13 文件基线来自方案审核（浏览器按 unicode-range 下载 13 个分片）。

## 全局约束

- 不删现有测试；完成后 `npm run typecheck`、`npm run test:unit`、`npm run build`、`npm run test:e2e` 全部保持通过（e2e 跑之前确认 4173 端口无残留进程；若其他任务正在跑 e2e 请稍候重试）。
- 缺字检查：fontTools `--no-ignore-missing-unicodes`（清单字符缺失即报错，不静默）。
- 禁止派发任何子代理。

## 交付与报告契约

- 新增：scripts/collect-font-chars.ts、scripts/prepare-fonts.py、tools/fonts/requirements.txt、assets/fonts-source/（2 otf + LICENSE + 来源记录）、src/assets/fonts/（2 woff2 子集）、src/styles/fonts.css、tests/unit/font-chars.test.ts、.generated/font-chars.txt。
- 修改：src/main.ts、package.json（如脚本需要）。
- 完整报告写入 .superpowers/sdd/2026-09-21-home-improvement/task-7-report.md：fontTools/brotli 精确版本、字符清单字符数、子集体积（600/700 各多少 KB）、before/after 传输量对比（文件数与字节）、覆盖率与缺字检查结果、构建重建方式说明（给 T8 接入用）、测试结果、遗留。
- 最终回复：状态 / 改动文件 / 一行测试结论 / 体积对比一行 / 关注点。
