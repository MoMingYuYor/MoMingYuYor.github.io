/**
 * 统一验证入口（技术方案 6.4 / T8）：
 *   1/7 内容与本地资源检查（check:content，含 checkLocalAssets 文件系统关口）
 *   2/7 类型检查（typecheck）
 *   3/7 单元与组件测试（test:unit，进程初始限时 60 秒，超时终止整个进程树）
 *   4/7 生产构建（build = check:content + fonts:build + vite build）
 *   5/7 E2E（playwright，CI=1 强制使用本次构建新起的预览服务，不复用已有服务）
 *   6/7 子路径构建（SITE_BASE=/personal/ 输出 .generated/subpath-dist，不覆盖 dist）
 *   7/7 子路径资源冒烟（index.html 全部本地引用必须带 /personal/ 前缀）
 *
 * 串行执行：任一步非零退出立即以相同退出码结束；普通构建与子路径构建不并发写目录。
 * 本脚本只编排验证，不负责安装或升级依赖。E2E 前预检 4173 端口，占用时给出明确提示。
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from 'node:net'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IS_WIN = process.platform === 'win32'
/** 子路径验收的发布 base（与 vite.config.ts 的 SITE_BASE 机制配套） */
const SUBPATH_BASE = '/personal/'
/** E2E 预览服务端口（与 playwright.config.ts 一致） */
const E2E_PORT = 4173

interface StepRecord {
  label: string
  code: number
}

/** 含空格的参数加引号（cmd /c 整行拼接需要） */
function quoteArg(arg: string): string {
  return /[\s"]/.test(arg) ? `"${arg}"` : arg
}

/** 终止整个进程树：Windows 用 taskkill /T；POSIX 用进程组信号（子进程以 detached 启动） */
function killTree(pid: number): void {
  if (IS_WIN) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      /* 进程可能已经退出 */
    }
  }
}

/** 运行一个步骤：继承 stdio，返回退出码；超时终止进程树并以 124 结束 */
function runStep(
  label: string,
  command: string,
  options: { args?: string[]; env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<number> {
  const args = options.args ?? []
  return new Promise((resolveCode) => {
    const description = [command, ...args].join(' ')
    console.log(`\n==> [${label}] ${description}`)
    const child = IS_WIN
      ? spawn('cmd.exe', ['/d', '/s', '/c', [command, ...args.map(quoteArg)].join(' ')], {
          cwd: ROOT,
          stdio: 'inherit',
          env: { ...process.env, ...options.env },
        })
      : spawn(command, args, {
          cwd: ROOT,
          stdio: 'inherit',
          env: { ...process.env, ...options.env },
          detached: true,
        })
    let settled = false
    const finish = (code: number): void => {
      if (settled) return
      settled = true
      resolveCode(code)
    }
    const timer = options.timeoutMs
      ? setTimeout(() => {
          console.error(`\n步骤超时（${options.timeoutMs}ms），终止进程树：${label}`)
          if (child.pid) killTree(child.pid)
          finish(124)
        }, options.timeoutMs)
      : undefined
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      console.error(`步骤无法启动：${description}\n${error}`)
      finish(127)
    })
    child.on('exit', (code, signal) => {
      if (timer) clearTimeout(timer)
      finish(code ?? (signal ? 1 : 1))
    })
  })
}

/** 端口占用探测：能建立 TCP 连接即视为被占用（ECONNREFUSED 才是空闲） */
function isPortBusy(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolveBusy) => {
    const socket = connect({ port, host })
    socket.setTimeout(1500)
    socket.once('connect', () => {
      socket.destroy()
      resolveBusy(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolveBusy(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolveBusy(false)
    })
  })
}

/**
 * 子路径资源冒烟：.generated/subpath-dist/index.html 中所有以 / 开头的本地引用
 * （src/href）必须以发布 base 开头；远程 https 与协议无关 // 引用不检查。
 */
function smokeSubpathDist(base: string): string[] {
  const htmlPath = resolve(ROOT, '.generated/subpath-dist/index.html')
  let html: string
  try {
    html = readFileSync(htmlPath, 'utf8')
  } catch {
    return [`子路径产物不存在：${htmlPath}`]
  }
  const problems: string[] = []
  const refs = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((match) => match[1] ?? '')
  if (!refs.some((ref) => ref.startsWith(`${base}assets/`))) {
    problems.push(`index.html 中找不到 ${base}assets/ 前缀的构建资源引用`)
  }
  for (const ref of refs) {
    if (ref.startsWith('/') && !ref.startsWith('//') && !ref.startsWith(base)) {
      problems.push(`资源引用未带发布 base 前缀：${ref}`)
    }
  }
  return problems
}

async function main(): Promise<number> {
  console.log('verify：串行执行内容检查 → 类型检查 → 单元测试 → 构建 → E2E → 子路径构建与冒烟')
  const records: StepRecord[] = []

  const record = async (label: string, codePromise: Promise<number>): Promise<boolean> => {
    const code = await codePromise
    records.push({ label, code })
    return code === 0
  }

  // 1/7 内容结构校验 + 本地媒体资源文件系统检查
  if (!(await record('1/7 check:content', runStep('1/7 check:content', 'npm', { args: ['run', 'check:content'], timeoutMs: 120_000 })))) {
    return records.at(-1)!.code
  }
  // 2/7 类型检查
  if (!(await record('2/7 typecheck', runStep('2/7 typecheck', 'npm', { args: ['run', 'typecheck'], timeoutMs: 300_000 })))) {
    return records.at(-1)!.code
  }
  // 3/7 单元与组件测试：初始限时 60 秒，超时终止整个进程树
  if (!(await record('3/7 test:unit', runStep('3/7 test:unit', 'npm', { args: ['run', 'test:unit'], timeoutMs: 60_000 })))) {
    return records.at(-1)!.code
  }
  // 4/7 生产构建（普通构建写 dist）
  if (!(await record('4/7 build', runStep('4/7 build', 'npm', { args: ['run', 'build'], timeoutMs: 600_000 })))) {
    return records.at(-1)!.code
  }
  // 5/7 E2E：先预检端口，再以 CI=1 强制 webServer 新起本次构建的预览（不复用已有服务）
  if (await isPortBusy(E2E_PORT)) {
    console.error(
      `\n端口 ${E2E_PORT} 已被占用，E2E 无法新起本次构建的预览服务。\n` +
        '请先释放端口（例如结束残留的 node/preview 进程）后重试 npm run verify。',
    )
    records.push({ label: '5/7 test:e2e', code: 1 })
    return 1
  }
  if (!(await record('5/7 test:e2e', runStep('5/7 test:e2e', 'npm', { args: ['run', 'test:e2e'], env: { CI: '1' }, timeoutMs: 1_200_000 })))) {
    return records.at(-1)!.code
  }
  // 6/7 子路径构建：SITE_BASE 环境变量提供发布 base，输出独立目录（串行执行，不与普通构建并发写）
  if (
    !(await record(
      '6/7 subpath build',
      runStep('6/7 subpath build', 'npm', {
        args: ['run', 'build', '--', '--outDir=.generated/subpath-dist', '--emptyOutDir'],
        env: { SITE_BASE: SUBPATH_BASE },
        timeoutMs: 600_000,
      }),
    ))
  ) {
    return records.at(-1)!.code
  }
  // 7/7 子路径资源冒烟（纯本地文件检查，不发网络请求）
  const smokeProblems = smokeSubpathDist(SUBPATH_BASE)
  records.push({ label: '7/7 subpath smoke', code: smokeProblems.length === 0 ? 0 : 1 })
  if (smokeProblems.length > 0) {
    console.error(`\n子路径冒烟未通过（${SUBPATH_BASE}）：`)
    for (const problem of smokeProblems) console.error(`  - ${problem}`)
    return 1
  }
  console.log(`子路径冒烟通过：.generated/subpath-dist/index.html 全部本地引用带 ${SUBPATH_BASE} 前缀`)

  console.log('\n—— verify 各步退出码 ——')
  for (const { label, code } of records) console.log(`  ${label}: ${code}`)
  return 0
}

main().then((code) => {
  console.log(code === 0 ? '\nverify 全链通过。' : `\nverify 失败，退出码 ${code}。`)
  process.exit(code)
})
