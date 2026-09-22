/**
 * `npm run fonts:subset` 的跨平台包装（S1-T4）。
 *
 * 三件事：
 *  1. 定位 `tools/fonts/.venv` 的 Python（Windows 是 `Scripts/python.exe`，其他平台是
 *     `bin/python`）。npm 在 Windows 经 cmd.exe 执行脚本，直接在 package.json 里写
 *     `tools/fonts/.venv/Scripts/python.exe` 会因正斜杠命令路径被误解析，故由本包装解析。
 *  2. 依次对 600 与 700 两档调用 `scripts/prepare-fonts.py <字重>`，一档失败即停并以
 *     该档的非零退出码结束。
 *  3. 隔离环境或字符清单缺失时给出可读的中文提示与修复步骤，不静默跳过、不打印堆栈。
 *
 * 本脚本只在开发者本机维护字体子集时运行；`npm run build` 不依赖它。
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const venvPython =
  process.platform === 'win32'
    ? resolve(projectRoot, 'tools/fonts/.venv/Scripts/python.exe')
    : resolve(projectRoot, 'tools/fonts/.venv/bin/python')
const prepareScript = resolve(projectRoot, 'scripts/prepare-fonts.py')
/** 与 scripts/prepare-fonts.py 的 WEIGHTS 及 src/styles/fonts.css 的 @font-face 一致 */
const weights = [600, 700]

function abort(message) {
  console.error(`错误：${message}`)
  process.exit(1)
}

if (!existsSync(venvPython)) {
  abort(
    '字体子集隔离环境缺失（tools/fonts/.venv），拒绝静默跳过。\n' +
      '请先创建并安装冻结版本依赖：\n' +
      '  cd tools/fonts && python -m venv .venv\n' +
      '  tools/fonts/.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt\n' +
      '然后重新运行 npm run fonts:subset。',
  )
}

if (!existsSync(prepareScript)) {
  abort(`子集化脚本缺失：${relative(projectRoot, prepareScript)}`)
}

for (const weight of weights) {
  const charList = resolve(projectRoot, `src/assets/fonts/chars-${weight}.txt`)
  if (!existsSync(charList)) {
    abort(
      `字符清单缺失：${relative(projectRoot, charList)}\n` +
        '先运行 npm run fonts:collect（字符清单以构建产物 dist/ 为准，需先 npm run build）。',
    )
  }
}

for (const weight of weights) {
  const result = spawnSync(venvPython, [prepareScript, String(weight)], { stdio: 'inherit' })
  if (result.error) {
    abort(`无法启动 Python（${relative(projectRoot, venvPython)}）：${result.error.message}`)
  }
  if (result.status !== 0) {
    abort(`字重 ${weight} 的子集化失败（退出码 ${result.status ?? 'null'}），已停止后续字重。`)
  }
}
