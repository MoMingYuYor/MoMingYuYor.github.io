# Task 7 报告：字体裁剪先验证后接入（T7）

日期：2026-09-21　执行：T7 实现工程师（串行，无子代理）
需求：`.superpowers/sdd/2026-09-21-home-improvement/task-7-brief.md`（含控制器裁决 1–6，逐条落实）

## 结论

- **体积预算达成**：冷缓存整页浏览字体传输量 **489,820 B（13 文件）→ 146,816 B（2 文件），降低 70.0%**，远超 40% 预算（≤293,892 B），且未删任何字符或字重。
- 视觉对比（document.fonts.ready 后桌面首屏截图）与替换前一致：同字形、同字重层级（600/700）。
- 慢网（woff2 延迟 2.5s）回退窗口 `document.fonts.status = loading` 时整页以系统衬线回退呈现，无方框、无布局塌陷（`font-display: swap` 生效）。
- 缺字校验非静默：脚本先做显式 cmap 全量校验（缺失即列出 U+XXXX 报错退出），fontTools 侧 `ignore_missing_unicodes=False` 兜底。
- **dev/build 自动重建链路按裁决不做**（留给 T8 串行接入），本任务交付手动可复现脚本 + 接入说明（见下）。

## 工具链与隔离环境

- Python 3.14.7（系统已有）；隔离环境 `tools/fonts/.venv`（`python -m venv`，未全局安装）。
- 精确版本（`pip freeze` 冻结进 `tools/fonts/requirements.txt`）：
  - `fonttools==4.65.0`
  - `brotli==1.2.0`
- `prepare-fonts.py` 内置 venv 守卫：非隔离环境运行直接报错退出。

## 字符清单

- 生成：`npx tsx scripts/collect-font-chars.ts` → `.generated/font-chars.txt`
- **字符数：356**（去重升序，单字符一行；`# ` 开头为注释）
- 组成：
  1. `src/content/site.ts` 深度遍历全部字符串字段（含非激活画廊条目、项目详情 role/period/background/outcome、contacts、about.paragraphs、hero 文案、galleries 文案、seo、图片 alt）；
  2. 组件固定标签（脚本内 `COMPONENT_FIXED_LABELS`，逐组注明来源）：App.vue 跳转链接与"首页"、Header.vue 品牌"暮色/晴光 / DARK/LIGHT"与菜单 aria、ThemeSwitch.vue"跟随系统/浅色/深色/主题偏好："、Hero.vue aria 与 datetime.ts 问候全部分支、GallerySection.vue"条目"与 CSS content 引号"“”"、ProjectGallery.vue 详情标签"角色/时间/背景/成果"与"访问项目/查看源码"、AboutSection.vue"联系方式"与音频错误提示、Footer.vue"内容与图片为示意©"、星期"周一…周日"与月份"十"、日期数字 `0123456789/-`、标点 `：，。·`、index.html noscript 文案。
- 回退清单（刻意不进衬线子集，由系统字体/图标呈现，已写入清单文件注释并在脚本中双向防御）：`◐ ☀ ☾ ☰ ✕ →`

## 子集产物与体积

| 字重 | 源（assets/fonts-source/） | 子集（.generated/fonts/ 与 src/assets/fonts/ 同步） | 体积 |
| --- | --- | --- | --- |
| 600 | NotoSerifSC-600.otf（24,700,256 B，OTF 静态实例） | noto-serif-sc-600.woff2 | **72,408 B** |
| 700 | NotoSerifSC-700.otf（25,521,460 B，OTF 静态实例） | noto-serif-sc-700.woff2 | **74,408 B** |

- 子集化选项（`scripts/prepare-fonts.py`）：`--flavor=woff2` 等价项、缺字报错、保留 name ID 0/13/14（许可元信息，已验证 woff2 内含 OFL 声明与链接）、`layout_features=[kern,liga,ccmp,mark,mkmk]`（横向排版必需；实测全量 `*` 会经 GSUB 闭包把 356 字符拉到 864 字形 +58% 体积）、丢弃纯垂直表 vhea/vmtx/VORG、`desubroutinize=True`（brotli 压缩更充分，实测再省约 12%，无视觉差异）。
- 输出 357 字形（356 字符 + .notdef）。归档说明与来源：`assets/fonts-source/sources.md` + `LICENSE`（OFL 1.1）。

## before / after 传输量对比（冷缓存整页浏览，playwright 实测响应体字节）

- 方式：`.generated/font-baseline/measure-fonts.mjs`（每次全新 context；分步滚动全页 + 点开全部 6 个画廊标签使 v-show 隐藏面板的文本也触发字体加载；`document.fonts.ready` 后截图）。
- before（@fontsource 101 分片 CSS，浏览器按 unicode-range 取 13 片）：**13 请求 / 489,820 B（478.3 KB）** → `.generated/font-baseline/before.json`、`before-desktop-hero.png`、`before-desktop-full.png`
- after（本地 2 个子集）：**2 请求 / 146,816 B（143.4 KB）** → `after.json`、`after-desktop-hero.png`、`after-desktop-full.png`
- **降幅 70.0%**（预算线 293,892 B，实际 146,816 B）。加载的 FontFace：13 → 2（600/700 各一）。
- 截图对比：首屏排版、字形、字重一致。注：after 截图中导航"首页"多出强调色下划线，为并行任务 19:59 在 Header.vue 新增的 activeSectionId 指示样式（重建自然包含），与字体无关。
- 慢网回退：`.generated/font-baseline/slow-network-check.mjs`，woff2 延迟 2.5s，回退窗口截图 `slow-network-fallback-mid.png`（status=loading，系统衬线呈现、无方框）、就绪后 `slow-network-fallback-loaded.png`。

## 缓存

- `prepare-fonts.py` 以「字符清单负载 sha256 + 各 OTF 源 sha256 + fonttools/brotli 版本」为缓存键，存 `.generated/fonts/.cache-key.json`；键一致且产物齐全时跳过（已实测打印"跳过子集化"）。清单或字体源任一变化即重建。

## 内容变更后的重建方式（给 T8 接入）

```sh
npm run fonts:build        # = fonts:collect + fonts:subset
# fonts:collect: npx tsx scripts/collect-font-chars.ts   → .generated/font-chars.txt
# fonts:subset : tools/fonts/.venv/Scripts/python.exe scripts/prepare-fonts.py
#                → .generated/fonts/*.woff2 并复制到 src/assets/fonts/
```

- T8 接入建议：在 `vite.config.ts` 的构建/开发钩子中依次调用上述两步（或在 `check:content` 旁挂同链路），因字体源在 `src/assets/fonts/`，Vite 自动完成 hash 与 base，无需其他改动。注意 `fonts:subset` 依赖 `tools/fonts/.venv`，若 CI 无该环境需先 `python -m venv tools/fonts/.venv && tools/fonts/.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt`。
- 本次按裁决**未改 vite.config.ts**（避免与 T6 冲突）。

## 交付物

新增：
- `scripts/collect-font-chars.ts`（可导入纯函数 + CLI 无副作用写文件）
- `scripts/prepare-fonts.py`（venv 守卫、cmap 缺字校验、hash 缓存、复制到 src/assets/fonts）
- `tools/fonts/requirements.txt`、`tools/fonts/.venv/`（隔离环境）
- `assets/fonts-source/NotoSerifSC-600.otf`、`NotoSerifSC-700.otf`、`LICENSE`、`sources.md`
- `src/assets/fonts/noto-serif-sc-600.woff2`、`noto-serif-sc-700.woff2`
- `src/styles/fonts.css`（两条 @font-face：weight 600/700、`font-display: swap`；单子集省略 unicode-range；不改 tokens.css）
- `tests/unit/font-chars.test.ts`（9 用例）
- `.generated/font-chars.txt`、`.generated/fonts/*`、`.generated/font-baseline/*`

修改：
- `src/main.ts`：仅将两行 `@fontsource/noto-serif-sc/600.css|700.css` 导入替换为 `import './styles/fonts.css'`（注释同步更新）
- `package.json`：新增 `fonts:collect` / `fonts:subset` / `fonts:build` 三个脚本

保留：`@fontsource/noto-serif-sc` 依赖未卸载（回退保险，不进 bundle）。

## 测试结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | ✅ 通过（期间一次失败系并行任务 `src/bootstrap/theme-bootstrap.ts` 在途错误 TS7006，其修复后复跑通过） |
| `npm run test:unit` | 我的 `font-chars.test.ts` 9/9 ✅；全量最终态 103/104——唯一失败 `tests/unit/theme-bootstrap.test.ts`（并行任务 20:08 新增的在途构建链文件，期望生成脚本含 `"base"` 键而生成器尚未输出；与本任务无关，A/B 验证：20:07 我的全量 85/85 全绿时已带本任务全部改动，其文件尚未落地） |
| `npm run build` | ✅ 通过，产物含 2 个 hash 命名的 woff2（@fontsource 分片不再进 bundle） |
| `npm run test:e2e` | ✅ 34/34 通过（4173 端口确认无残留后运行；期间一次 preload/section-spy 4 例失败经 @fontsource 回退 A/B 复测证明为并行任务在途状态所致，源稳定后全绿） |

覆盖与缺字检查：清单 356 字符全量存在于两字重 cmap（脚本校验 + 单测逐字符断言，含非激活条目与详情文本）；未发现缺字，无静默删字。

## 过程中发现并修复的问题

1. **prepare-fonts.py 空格丢字 bug**：清单解析用 `line.strip()` 把"空格"这个合法单字符行误判为空行（356 → 355），空格会静默缺席衬线子集（如"演示项目 · …"中 `·` 两侧空格）。已改为仅按空行/`# ` 注释过滤并显式断言空格在 cmap 中；重建后 356 字符全量入集（+96 B）。
2. **GSUB 闭包膨胀**：`layout_features='*'` 使 356 字符闭包出 864 字形（174 KB/字重）；改保留横向必需特性后 357 字形（72 KB/字重），此为达成预算的关键调整，非删字符。

## 遗留 / 交接

- dev/build 自动重建链路由 T8 接入（方式见上节）。
- `tests/unit/theme-bootstrap.test.ts` 1 例失败与 typecheck 历史失败均为并行任务在途文件，报告时点未恢复全绿的部分以其负责人收口为准；本任务改动 A/B 验证无回归。
- 字体源 OTF 共约 48 MB 位于 `assets/fonts-source/`，属源归档不入 bundle；如仓库有体积敏感要求，可后续评估 Git LFS（本项目当前无 Git）。
- 若未来新增字重（如 400），需同步 `prepare-fonts.py` WEIGHTS 与 `fonts.css`。
