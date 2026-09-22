/**
 * fonts:subset 的跨平台包装（T8）：
 * npm 在 Windows 经 cmd.exe 执行脚本，直接调用 `tools/fonts/.venv/Scripts/python.exe`
 * 会因正斜杠命令路径被误解析；本包装以 Node 解析平台正确的 venv Python 路径，
 * 并在隔离环境缺失时给出明确报错与安装指引（不静默跳过，技术方案 6.4 / T7 交接要求）。
 *
 * 成功时以子进程退出码退出；venv Python 不存在时退出码 1。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const venvPython =
  process.platform === 'win32'
    ? resolve(projectRoot, 'tools/fonts/.venv/Scripts/python.exe')
    : resolve(projectRoot, 'tools/fonts/.venv/bin/python')
const script = resolve(projectRoot, 'scripts/prepare-fonts.py')

if (!existsSync(venvPython)) {
  console.error(
    '错误：字体子集隔离环境缺失（tools/fonts/.venv），拒绝静默跳过。\n' +
      '请先创建并安装精确版本依赖：\n' +
      '  cd tools/fonts && python -m venv .venv\n' +
      '  tools/fonts/.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt\n' +
      '然后重新运行 npm run fonts:build。',
  )
  process.exit(1)
}

const result = spawnSync(venvPython, [script], { stdio: 'inherit' })
process.exit(result.status ?? 1)
