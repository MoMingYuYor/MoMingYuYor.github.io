import type { CollectionName } from './schema'

/** 扁平化后的 frontmatter 记录；与 Astro runtime entry 解耦，便于纯 Node 校验 */
export interface SnapshotEntry {
  readonly collection: CollectionName
  readonly id: string
  readonly filePath: string
  readonly data: Record<string, unknown>
  readonly body: string
}

export type CollectionSnapshot = Record<CollectionName, readonly SnapshotEntry[]>

export const COLLECTION_NAMES: readonly CollectionName[] = [
  'projects',
  'posts',
  'builds',
  'overclocking',
]

export function emptySnapshot(): CollectionSnapshot {
  return { projects: [], posts: [], builds: [], overclocking: [] }
}
