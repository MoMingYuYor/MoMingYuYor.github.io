# MoMingYu 的个人主页

[https://momingyuyor.github.io/](https://momingyuyor.github.io/)

沉浸式风景首屏与分章节画廊的个人主页：明暗双主题（暮色 / 晴光）、衬线排印、可键盘完整操作。基于 Vue 3 + TypeScript + Vite，构建产物为纯静态站点。

## 本地开发

```sh
npm install            # 安装依赖（版本以 package-lock.json 为准）
npm run dev            # 本地开发服务器
npm run build          # 内容校验 + 字体子集 + 生产构建到 dist
npm run verify         # 发布级全量验证（内容/类型/单测/构建/e2e/子路径）
npm run test:unit      # 单元与组件测试
npm run test:e2e       # Playwright 端到端检查（系统 Chrome）
```

## 常见维护

- **站点内容**：全部集中在 `src/content/site.ts`，构建时经 `validate.ts` 与 `check-assets.ts` 双重校验，错误会直接阻断构建。
- **字体子集**：展示用 Noto Serif SC 按 `src/content/site.ts` 实际用字裁剪。内容变更后运行 `npm run fonts:build` 并提交 `src/assets/fonts/` 下的新 woff2（需要本地 `tools/fonts/.venv`，环境与重建方式见 `assets/fonts-source/sources.md`；CI 使用入库的子集产物，不重复裁剪）。
- **部署**：推送到 `main` 分支后由 GitHub Actions 自动构建发布（`.github/workflows/deploy.yml`）。

页面内容中仍标注为"演示/待补充"的部分为占位资料，替换为真实资料并逐项核验前，站点保持 `noindex`。
