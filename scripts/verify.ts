/**
 * 发布级验证编排（S1-T11）。
 *
 * 串行执行，任一步失败立即以非零码退出：
 *   typecheck → test:unit → build → test:e2e → 子路径构建 → 子路径冒烟
 *
 * 两处刻意的设计：
 * 1. 子路径构建在 Node 里设置 `SITE_BASE`，不依赖调用方 shell。Git Bash 会把
 *    `/personal/` 改写成 `/C:/Program Files/Git/personal/`（MSYS 路径转换），
 *    经由 shell 传参会得到错误 base，且产物看起来"构建成功"。
 * 2. 超时按**进程树**终止。子进程会派生 dev server 与浏览器，只杀父进程会留下
 *    占用端口与工程锁的孤儿进程，导致后续步骤静默复用错误的服务。
 *
 * 内容校验步骤由第二阶段 S2-T4 接入本链路首位；CI 工作流由第四阶段 S4-T5 建立，
 * 本脚本不修改 `.github/workflows/`。
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** 子路径部署冒烟用的 base；与 astro.config.mjs 读取的环境变量同名 */
const SUBPATH_BASE = '/personal/'
const SUBPATH_OUT_DIR = '.generated/subpath-dist'

/** 旧实现的构建注入标记：产物里出现即说明模板没被处理 */
const LEGACY_INJECTION_MARKERS = ['<!--site-meta-->', '<!--theme-bootstrap-->', '<!--noscript-contact-->']

interface StepResult {
  readonly name: string
  readonly ok: boolean
  readonly ms: number
}

interface Step {
  readonly name: string
  readonly command: string
  readonly args: readonly string[]
  readonly timeoutMs: number
  readonly env?: Record<string, string>
}

const STEPS: readonly Step[] = [
  { name: '1/6 类型检查', command: 'npm', args: ['run', 'typecheck'], timeoutMs: 300_000 },
  { name: '2/6 单元测试', command: 'npm', args: ['run', 'test:unit'], timeoutMs: 120_000 },
  { name: '3/6 生产构建', command: 'npm', args: ['run', 'build'], timeoutMs: 600_000 },
  {
    name: '4/6 浏览器测试',
    command: 'npx',
    args: ['playwright', 'test'],
    // CI=1 关闭 reuseExistingServer，避免静默复用端口上残留的其它服务
    timeoutMs: 1_200_000,
    env: { CI: '1' },
  },
  {
    name: '5/6 子路径构建',
    command: 'npx',
    args: ['astro', 'build', '--outDir', SUBPATH_OUT_DIR],
    timeoutMs: 600_000,
    env: { SITE_BASE: SUBPATH_BASE },
  },
  { name: '6/6 子路径冒烟', command: 'node', args: ['-e', 'process.exit(0)'], timeoutMs: 30_000 },
]

/** 终止整棵进程树：Windows 用 taskkill /T，其余平台对进程组发信号 */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    /* 进程已退出 */
  }
}

function runStep(step: Step): Promise<StepResult> {
  return new Promise((resolveStep) => {
    const started = Date.now()
    console.log(`\n=== ${step.name} ===`)
    const child = spawn(step.command, step.args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
      env: { ...process.env, ...step.env },
    })

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      console.error(`\n${step.name} 超时（${step.timeoutMs}ms），终止进程树`)
      if (child.pid) killTree(child.pid)
    }, step.timeoutMs)

    child.on('exit', (code) => {
      clearTimeout(timer)
      const ok = !timedOut && code === 0
      if (!ok && !timedOut) console.error(`\n${step.name} 失败（退出码 ${code}）`)
      resolveStep({ name: step.name, ok, ms: Date.now() - started })
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      console.error(`\n${step.name} 无法启动：${error.message}`)
      resolveStep({ name: step.name, ok: false, ms: Date.now() - started })
    })
  })
}

function listHtmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listHtmlFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full)
  }
  return files
}

/**
 * 子路径冒烟：产物的站内引用必须带 `/personal/` 前缀，且不含源码入口与未替换的注入标记。
 * 这条检查用来捕捉"构建成功但 base 传错"的情形——那种情况不会让构建失败。
 */
function smokeSubpath(): string[] {
  const outDir = resolve(ROOT, SUBPATH_OUT_DIR)
  const files = listHtmlFiles(outDir)
  const problems: string[] = []
  if (files.length === 0) return [`子路径产物为空：${relative(ROOT, outDir)} 下没有 HTML`]

  for (const file of files) {
    const label = relative(ROOT, file)
    const html = readFileSync(file, 'utf8')
    if (/src="[^"]*\.ts"/.test(html)) problems.push(`${label}：引用了 .ts 源码入口`)

    // 只匹配已知的构建注入标记名，不把普通 HTML 注释一律当成问题
    for (const marker of LEGACY_INJECTION_MARKERS) {
      if (html.includes(marker)) problems.push(`${label}：残留注入标记 ${marker}`)
    }

    for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const url = match[1]!
      if (!url.startsWith(SUBPATH_BASE)) {
        problems.push(`${label}：站内引用缺少 ${SUBPATH_BASE} 前缀 → ${url}`)
      }
    }
  }
  return problems
}

async function main(): Promise<void> {
  const results: StepResult[] = []
  for (const step of STEPS) {
    // 冒烟步骤不跑外部命令，直接执行检查
    if (step.name.endsWith('子路径冒烟')) {
      const started = Date.now()
      const problems = smokeSubpath()
      for (const problem of problems) console.error(`  ✗ ${problem}`)
      if (problems.length === 0) {
        console.log(`  ✓ 子路径产物的站内引用都带 ${SUBPATH_BASE} 前缀，且无源码入口与注入标记`)
      }
      results.push({ name: step.name, ok: problems.length === 0, ms: Date.now() - started })
      continue
    }

    const result = await runStep(step)
    results.push(result)
    if (!result.ok) break
  }

  console.log('\n=== 验证结果 ===')
  for (const result of results) {
    console.log(`${result.ok ? '✓' : '✗'} ${result.name}（${(result.ms / 1000).toFixed(1)}s）`)
  }
  const skipped = STEPS.length - results.length
  if (skipped > 0) console.log(`— 因前一步失败，跳过 ${skipped} 个步骤`)

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0 || skipped > 0) {
    console.error(`\n验证未通过：${failed.length} 步失败，${skipped} 步未执行`)
    process.exit(1)
  }
  console.log('\n全部步骤通过。注意：本脚本只覆盖工程侧检查，不构成"线上可用"或"内容可公开发布"的结论。')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
