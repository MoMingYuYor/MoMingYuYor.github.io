/**
 * 四个构建时内容集合的声明（规格第 8 节）。
 *
 * 内容目录可由 `SITE_CONTENT_DIR` 覆盖：只用于测试夹具构建，
 * 公开构建始终使用默认目录，夹具不会成为公开集合。
 */
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { collectionSchemas } from './content/schema'

const CONTENT_DIR = process.env.SITE_CONTENT_DIR ?? './src/content'

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${CONTENT_DIR}/projects` }),
  schema: collectionSchemas.projects,
})

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${CONTENT_DIR}/posts` }),
  schema: collectionSchemas.posts,
})

const builds = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${CONTENT_DIR}/builds` }),
  schema: collectionSchemas.builds,
})

const overclocking = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${CONTENT_DIR}/overclocking` }),
  schema: collectionSchemas.overclocking,
})

export const collections = { projects, posts, builds, overclocking }
