import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument } from 'yaml'

import { collectionSchemas, type CollectionName } from './schema'
import { COLLECTION_NAMES, emptySnapshot, type CollectionSnapshot, type SnapshotEntry } from './snapshot'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTENT_DIR = process.env.SITE_CONTENT_DIR ?? 'src/content'
const CONTENT_ROOT = resolve(ROOT, CONTENT_DIR)

export interface SnapshotIssue {
  readonly path: string
  readonly message: string
}

export interface LoadSnapshotResult {
  readonly snapshot: CollectionSnapshot
  readonly issues: readonly SnapshotIssue[]
}

function listMarkdown(dir: string): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return listMarkdown(full)
      return entry.isFile() && entry.name.endsWith('.md') ? [full] : []
    })
    .sort()
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) throw new Error('文件必须以 YAML frontmatter 分隔符 --- 开始')
  const close = normalized.indexOf('\n---', 4)
  if (close < 0) throw new Error('缺少结束 frontmatter 的 --- 分隔符')
  const frontmatter = normalized.slice(4, close)
  const after = normalized.slice(close + 4)
  const body = after.startsWith('\n') ? after.slice(1) : after
  return { frontmatter, body }
}

function formatSchemaPath(path: readonly PropertyKey[]): string {
  return path.length === 0 ? '(root)' : path.map(String).join('.')
}

function parseEntry(collection: CollectionName, filePath: string): { entry?: SnapshotEntry; issues: SnapshotIssue[] } {
  const issuePath = relative(ROOT, filePath).replaceAll('\\', '/')
  const raw = readFileSync(filePath, 'utf8')
  let separated: { frontmatter: string; body: string }
  try {
    separated = splitFrontmatter(raw)
  } catch (error) {
    return {
      issues: [{ path: issuePath, message: error instanceof Error ? error.message : String(error) }],
    }
  }

  const document = parseDocument(separated.frontmatter, { uniqueKeys: true })
  if (document.errors.length > 0) {
    return {
      issues: document.errors.map((error) => ({ path: issuePath, message: error.message })),
    }
  }
  const parsed = document.toJS() as unknown
  const result = collectionSchemas[collection].safeParse(parsed)
  if (!result.success) {
    return {
      issues: result.error.issues.map((issue) => ({
        path: `${issuePath}: ${formatSchemaPath(issue.path)}`,
        message: issue.message,
      })),
    }
  }

  const data = result.data as Record<string, unknown>
  const slug = typeof data.slug === 'string' ? data.slug : relative(join(ROOT, CONTENT_DIR, collection), filePath)
  return {
    entry: {
      collection,
      id: slug,
      filePath: issuePath,
      data,
      body: separated.body,
    },
    issues: [],
  }
}

/**
 * 读取所有集合目录，解析 frontmatter 并应用对应 Schema。
 * 单文件错误进入 issues，不会中断读取其它条目；调用者可以一次展示全部问题。
 */
export function loadSnapshot(): LoadSnapshotResult {
  const snapshot = emptySnapshot() as Record<CollectionName, SnapshotEntry[]>
  const issues: SnapshotIssue[] = []

  for (const collection of COLLECTION_NAMES) {
    const directory = join(CONTENT_ROOT, collection)
    for (const filePath of listMarkdown(directory)) {
      const parsed = parseEntry(collection, filePath)
      issues.push(...parsed.issues)
      if (parsed.entry) snapshot[collection].push(parsed.entry)
    }
  }

  return { snapshot, issues }
}
