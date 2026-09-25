/**
 * 夹具构建与断言（S2-T4 / S2-T5 的 0/1/多条覆盖）。
 *
 * 公开构建里的唯一项目是 draft，因此"单条"与"多条"两种索引形态无法在公开产物上验证。
 * 这里用 `SITE_CONTENT_DIR` 指向隔离夹具，分别构建到 `.generated/fixture-*`，
 * 再用产物 HTML 断言：形态判定、草稿不泄漏、详情页只在存在公开条目时生成。
 *
 * 每次构建单独起一个子进程：Astro 的内容层有工程级缓存，同进程内切换内容目录不可靠。
 * 夹具产物与公开 `dist/` 分开，避免并发写同一目录。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

interface FixtureCase {
  readonly name: string
  readonly contentDir: string
  readonly outDir: string
}

const CASES: readonly FixtureCase[] = [
  {
    name: 'single',
    contentDir: 'tests/fixtures/content-single',
    outDir: '.generated/fixture-single',
  },
  {
    name: 'multi',
    contentDir: 'tests/fixtures/content-multi',
    outDir: '.generated/fixture-multi',
  },
]

function buildFixture(fixture: FixtureCase): void {
  console.log(`\n=== 构建夹具：${fixture.name}（内容目录 ${fixture.contentDir}） ===`)
  // 用单个命令串 + shell：Windows 下 npx 需要 shell，而给 shell 传参数数组会触发
  // Node 的 DEP0190（参数不转义）。outDir 与内容目录都来自本文件常量，不含用户输入。
  const result = spawnSync(`npx astro build --outDir ${fixture.outDir}`, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SITE_CONTENT_DIR: fixture.contentDir, SITE_MODE: 'preview' },
  })
  if (result.status !== 0) {
    console.error(`夹具 ${fixture.name} 构建失败（退出码 ${result.status}）`)
    process.exit(1)
  }
}

function read(fixture: FixtureCase, ...segments: string[]): string {
  const file = join(ROOT, fixture.outDir, ...segments)
  if (!existsSync(file)) throw new Error(`缺少产物：${relative(ROOT, file)}`)
  return readFileSync(file, 'utf8')
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ✗ ${message}`)
    process.exitCode = 1
    return
  }
  console.log(`  ✓ ${message}`)
}

function main(): void {
  for (const fixture of CASES) buildFixture(fixture)

  const single = CASES[0]!
  const multi = CASES[1]!

  console.log('\n=== 单条夹具断言 ===')
  const singleIndex = read(single, 'projects', 'index.html')
  assert(singleIndex.includes('data-presentation="single"'), '索引形态判定为 single')
  assert(!singleIndex.includes('data-presentation="index"'), '不出现索引布局标记')
  assert(singleIndex.includes('夹具项目一'), '渲染了公开条目的标题')
  assert(existsSync(join(ROOT, single.outDir, 'projects', 'fixture-one', 'index.html')), '生成了详情页')
  assert(
    !existsSync(join(ROOT, single.outDir, 'projects', 'fixture-draft', 'index.html')),
    '草稿没有生成详情页',
  )

  const singleDetail = read(single, 'projects', 'fixture-one', 'index.html')
  assert(singleDetail.includes('夹具正文'), '详情页渲染了 Markdown 正文')
  assert(singleDetail.includes('独立开发'), '详情页渲染了角色字段')
  assert(singleDetail.includes('作品'), '详情页有返回作品索引入口')

  console.log('\n=== 多条夹具断言 ===')
  const multiIndex = read(multi, 'projects', 'index.html')
  assert(multiIndex.includes('data-presentation="index"'), '索引形态判定为 index')
  assert(multiIndex.includes('夹具项目一') && multiIndex.includes('夹具项目二'), '两条都渲染')
  assert(!multiIndex.includes('夹具草稿'), '草稿标题不出现在索引')
  assert(!multiIndex.includes('草稿正文'), '草稿正文不出现在索引')
  assert(
    !existsSync(join(ROOT, multi.outDir, 'projects', 'fixture-draft', 'index.html')),
    '草稿没有生成详情页',
  )
  assert(
    existsSync(join(ROOT, multi.outDir, 'projects', 'fixture-two', 'index.html')),
    '第二条也生成了详情页',
  )

  console.log(
    process.exitCode === 1 ? '\n夹具验证未通过。' : '\n夹具验证通过：0/1/多条三种形态与草稿不泄漏均已覆盖。',
  )
}

main()
