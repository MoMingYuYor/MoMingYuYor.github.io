# Task 4 Brief：兴趣与作品分层，加入页内详情

项目：D:\Chatgpt\个人主页（Vue 3 + TS + Vite 个人主页，无 Git）。本任务是四阶段改造第三阶段的展示变体任务。

## 需求原文（技术方案 5.1/5.2 + 实施计划 T4，逐条落实）

### 技术方案 5.1 图库的展示变体

为 `GallerySection` 增加必填表现属性 `variant: 'interest' | 'project'`，由两个包装组件显式传入。它只决定选项外观、主图比例和辅助说明位置，选中、键盘、错误处理仍共用现有逻辑。不得复制两套图库状态实现。

兴趣展示侧重照片和短说明。桌面保留大图与精简主题列表，手机优先紧凑文字主题条、主图、短说明，装饰引文放在主内容之后。项目展示侧重截图或封面、项目名称、概要与成果；手机使用紧凑选择器和独立的详情入口。主图中的截图始终完整显示，照片允许配置焦点裁切。

### 技术方案 5.2 项目页内详情

复用现有 `ProjectItem` 字段，不为这次改造强制迁移内容模型。默认显示 `title`、`summary`，并把 `outcome` 作为成果摘要；`role`、`period`、`background` 放入"项目详情"展开区。访问与源码链接保持独立、可直接操作，不藏在必须展开的说明之后。演示值仍显式标记，不能变成虚构成果。

采用原生 `<details><summary>` 实现首版，不引入弹窗与新路由。摘要使用现有页面语义，不嵌套按钮；原生 Enter/Space 操作保持。各项目记住本次会话的展开状态，切换主题不重置；项目列表切换后焦点保持在所选标签，不强行跳入详情。展开区不设固定高度，折叠时隐藏内容退出 Tab 顺序。若内容缺失，隐藏对应事实行；完整性要求由演示/发布内容校验决定。

### 实施计划 T4

输入：现有 `GalleryItem/ProjectItem`，不改字段。输出：`GallerySection` 的 `variant: 'interest' | 'project'` 与原生详情展开。

- 在两个包装组件显式传入 variant；先写"兴趣不展示项目事实、作品详情默认折叠"的测试。
- 兴趣手机端改为文字主题条；作品维持精简缩略图选择器，概要与成果优先展示。
- ProjectGallery 默认保留概要、成果及访问链接，角色、时间、背景进入 details。现有列表项按 id 保留 DOM，主题不重建组件。
- 测试原生键盘展开、折叠后内部链接退出 Tab 顺序、项目切换和主题切换不错误重置展开状态。

详情结构起点：

```vue
<p class="project-outcome">{{ item.outcome }}</p>
<details class="project-details">
  <summary>项目详情</summary>
  <dl><!-- 角色、时间、背景，使用现有字段渲染 --></dl>
</details>
<!-- 访问项目、源码链接仍在 details 外部 -->
```

运行：`npm run test:unit -- tests/components/project-details.spec.ts` 并扩充 `visual.spec.ts` 的详情展开截图。通过依据为 A05。演示事实仍用现有占位，不能撰写虚构成果。

## 当前代码事实

- `src/components/GallerySection.vue`：T2/T3 刚改过——面板内含主图 figure、标题行（衬线大字+装饰箭头）、summary、details slot；tabs 键盘契约、按 URL 失败状态、scrollIntoView nearest。variant 属性加入后按需分支外观（缩略图尺寸/文字条/主图比例），键盘与状态逻辑不动。
- `src/components/InterestGallery.vue` / `ProjectGallery.vue`：从 site.galleries 读 heading/intro/aside 传入；ProjectGallery 的 details slot 现渲染 project-facts dl（角色/时间/背景/成果四行）+ project-links（访问/源码）。
- T3 后缩略图 72x48；T4 按 variant：兴趣手机端文字主题条（无缩略图或极简），作品缩略图 48–64px（T3 的 72px 需按参数表收敛到 64 或保留并说明——参数表"作品使用 48–64px 缩略图"，取 64x42 或 64x40 一档，报告记录）。
- "主图中的截图始终完整显示"：kind === 'screenshot' 走 object-fit: contain + padding（现有 .gallery-frame.is-screenshot 规则，T3 后仍在）。当前演示数据全是 photo；variant 分支保持该规则即可。
- 视觉基线：tests/e2e/visual.spec.ts 会拍画廊章节截图——T4 改变画廊外观后，重拍 after 基线（VISUAL_SLOT=after）并在报告注明（这会更新 T3 建立的基线，属预期演进）。

## 全局约束

- 不复制两套图库状态实现；键盘/选中/失败处理共用。
- 现有列表项按 id 保留 DOM（`:key` 已是 item.id，不要改成 index）；主题切换不重建组件（现有实现满足，勿引入 :key=theme 之类）。
- 演示占位文本保持"演示/待补充"字样，不撰写虚构成果。
- 不得削弱现有测试；完成后 npm run typecheck、test:unit、test:e2e 全量通过（4173 端口先检查，被占等 60–120 秒重试最多 3 次）。
- 你不碰：Header.vue、App.vue、Hero.vue、tokens.css、global.css、main.ts、src/lib/**（T5/T6/T7 并行中或刚完成）。**动手前先读 GallerySection.vue 最新版**。
- tests/components/gallery.spec.ts 是 T2 的既有组件测试——你新增 project-details.spec.ts，若 variant 改动导致 gallery.spec 个别用例选择器失配，允许最小修改保持其通过（在报告列出改动行）。

## 交付与报告契约

- 修改：src/components/GallerySection.vue、src/components/InterestGallery.vue、src/components/ProjectGallery.vue、tests/e2e/visual.spec.ts（扩充详情展开截图步骤）、（如需）tests/components/gallery.spec.ts 最小适配；新增：tests/components/project-details.spec.ts。
- 测试先行：先写 project-details.spec.ts 的"兴趣不展示项目事实/作品详情默认折叠"两例确认当前失败（存 .generated/t4-red-output.txt），再实现。
- 完整报告写入 task-4-report.md：改动文件、variant 分支说明（每处分支改了什么）、details 展开状态的会话保持实现、每个验收点验证方式与结果、测试输出、重拍基线说明、遗留。
- 最终回复：状态 / 改动文件 / 一行测试结论 / 关注点。
