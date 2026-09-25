/**
 * 页面侧读取公开内容的**唯一入口**（规格第 8 节）。
 *
 * 页面不直接调用 `getCollection`，否则每处都要自己重复发布过滤，迟早漏掉一处。
 * 本模块把"取全部条目 → 应用同一发布规则 → 排序"收敛到一处，并暴露各集合的公开 slug 集合
 * 供关联引用解析使用。
 */
import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'

import { filterResolvableRefs, selectPublished, type EntryRef } from '../lib/publication'

export type ProjectEntry = CollectionEntry<'projects'>
export type PostEntry = CollectionEntry<'posts'>
export type BuildEntry = CollectionEntry<'builds'>
export type OverclockingEntry = CollectionEntry<'overclocking'>

export type PublicEntry = ProjectEntry | PostEntry | BuildEntry | OverclockingEntry

export interface PublicSet {
  readonly projects: readonly ProjectEntry[]
  readonly posts: readonly PostEntry[]
  readonly builds: readonly BuildEntry[]
  readonly overclocking: readonly OverclockingEntry[]
  /** 各集合的公开 slug，供关联引用解析 */
  readonly slugsByCollection: ReadonlyMap<string, ReadonlySet<string>>
}

/** 按发布日期倒序；同日按 slug 升序，保证构建结果稳定可复现 */
function byPublishedAtDesc(a: PublicEntry, b: PublicEntry): number {
  const left = a.data.publishedAt?.getTime() ?? 0
  const right = b.data.publishedAt?.getTime() ?? 0
  if (left !== right) return right - left
  return a.data.slug.localeCompare(b.data.slug)
}

let cached: PublicSet | null = null

/**
 * 取公开内容集合。结果在单次构建内缓存：同一份构建时钟与同一份内容，
 * 重复调用不应产生不同结果。
 */
export async function getPublicSet(): Promise<PublicSet> {
  if (cached) return cached

  const now = new Date()
  const [projects, posts, builds, overclocking] = await Promise.all([
    getCollection('projects'),
    getCollection('posts'),
    getCollection('builds'),
    getCollection('overclocking'),
  ])

  const publicProjects = selectPublished(projects, now).sort(byPublishedAtDesc)
  const publicPosts = selectPublished(posts, now).sort(byPublishedAtDesc)
  const publicBuilds = selectPublished(builds, now).sort(byPublishedAtDesc)
  const publicOverclocking = selectPublished(overclocking, now).sort(byPublishedAtDesc)

  const slugsByCollection = new Map<string, ReadonlySet<string>>([
    ['projects', new Set(publicProjects.map((entry) => entry.data.slug))],
    ['posts', new Set(publicPosts.map((entry) => entry.data.slug))],
    ['builds', new Set(publicBuilds.map((entry) => entry.data.slug))],
    ['overclocking', new Set(publicOverclocking.map((entry) => entry.data.slug))],
  ])

  cached = {
    projects: publicProjects,
    posts: publicPosts,
    builds: publicBuilds,
    overclocking: publicOverclocking,
    slugsByCollection,
  }
  return cached
}

export async function getPublicProjects(): Promise<readonly ProjectEntry[]> {
  return (await getPublicSet()).projects
}

export async function getPublicProject(slug: string): Promise<ProjectEntry | undefined> {
  return (await getPublicSet()).projects.find((entry) => entry.data.slug === slug)
}

export async function getPublicPosts(): Promise<readonly PostEntry[]> {
  return (await getPublicSet()).posts
}

export async function getPublicBuilds(): Promise<readonly BuildEntry[]> {
  return (await getPublicSet()).builds
}

export async function getPublicOverclocking(): Promise<readonly OverclockingEntry[]> {
  return (await getPublicSet()).overclocking
}

/** 解析条目上的关联引用，丢掉指向草稿或不存在条目的项 */
export async function resolveRelated(refs: readonly EntryRef[]): Promise<EntryRef[]> {
  return filterResolvableRefs(refs, (await getPublicSet()).slugsByCollection)
}

/** 供测试与校验重置缓存（构建期不调用） */
export function resetPublicSetCache(): void {
  cached = null
}
