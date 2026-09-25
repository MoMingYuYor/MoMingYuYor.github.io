/**
 * Astro 内容模型 Schema（规格第 8 节）。
 *
 * 公共字段决定发布过滤与所有列表/元数据的取数。项目字段与规格第 8 节完全对齐；
 * posts/builds/overclocking 本阶段只声明公共字段与相关引用，专用字段由第三阶段追加。
 *
 * `slug` 显式存储在 frontmatter，不从文件名推导：改标题或整理文件名不会改变公开 URL。
 */
import { z } from 'astro/zod'
import type { infer as Infer } from 'astro/zod'

import { PARAMETER_TARGETS, PART_CATEGORIES, PROJECT_STATUS, TECH_TAGS } from './taxonomy'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const slugSchema = z.string().regex(SLUG_PATTERN, 'slug 必须是 ASCII kebab-case')

/** 与 src/lib/media.ts 同结构；候选图、sizes 与裁切点必须来自同一描述 */
export const mediaRefSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  kind: z.enum(['photo', 'screenshot']),
  caption: z.string().min(1).optional(),
  credit: z.string().min(1).optional(),
  desktopPosition: z.string().optional(),
  mobilePosition: z.string().optional(),
  candidates: z.array(z.object({ src: z.string().min(1), width: z.number().int().positive() })).optional(),
  sizes: z.string().optional(),
})

export const commonFields = {
  slug: slugSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  publicationStatus: z.enum(['draft', 'published']),
  publishedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  featured: z.boolean().default(false),
  cover: mediaRefSchema.optional(),
}

export const commonSchema = z.object(commonFields)

export const refFields = {
  relatedProjects: z.array(slugSchema).default([]),
  relatedPosts: z.array(slugSchema).default([]),
  relatedBuilds: z.array(slugSchema).default([]),
  relatedOverclocking: z.array(slugSchema).default([]),
}

/** 项目维护状态独立于 publicationStatus，避免「已发布」被误读为「项目已完成」 */
export const projectFields = {
  role: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  projectStatus: z.enum(PROJECT_STATUS).optional(),
  problem: z.string().min(1).optional(),
  contribution: z.string().min(1).optional(),
  resultSummary: z.string().min(1).optional(),
  techTags: z.array(z.enum(TECH_TAGS)).default([]),
  screenshots: z.array(mediaRefSchema).default([]),
  evidence: z.array(z.object({
    label: z.string().min(1),
    href: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })).default([]),
  links: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).default([]),
  ...refFields,
}

export const projectSchema = commonSchema.extend(projectFields)

/**
 * 第三阶段只追加专用字段。未知 frontmatter 暂时保留，避免 Schema 骨架阶段
 * 丢掉尚未接入页面的草稿元数据；发布条目字段完整性由 validateCollections 校验。
 */
export const postSchema = commonSchema.extend(refFields).catchall(z.unknown())
export const buildSchema = commonSchema.extend(refFields).catchall(z.unknown())
export const overclockingSchema = commonSchema.extend(refFields).catchall(z.unknown())

export const collectionSchemas = {
  projects: projectSchema,
  posts: postSchema,
  builds: buildSchema,
  overclocking: overclockingSchema,
} as const

export type CollectionName = keyof typeof collectionSchemas
export type CommonData = Infer<typeof commonSchema>
export type ProjectData = Infer<typeof projectSchema>
export type MediaRef = Infer<typeof mediaRefSchema>
export type ProjectStatusValue = (typeof PROJECT_STATUS)[number]
export type PartCategoryValue = (typeof PART_CATEGORIES)[number]
export type ParameterTargetValue = (typeof PARAMETER_TARGETS)[number]
