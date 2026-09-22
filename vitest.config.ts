import { defineConfig } from 'vitest/config'

/**
 * 单元测试只覆盖与框架无关的纯模块。
 * `tests/e2e/` 下是 Playwright 用例（文件名同为 *.spec.ts），由 `npm run test:e2e` 负责，
 * 必须在这里排除，否则 Vitest 会把它们当单测收集并在导入时报错。
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
