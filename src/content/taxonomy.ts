/**
 * 受控词表（跨阶段共享，统一路径 `src/content/taxonomy.ts`）。
 * 内容 frontmatter 存储稳定 ASCII id，页面展示 label；添加新值时需同时补充测试。
 */
export const TECH_TAGS = [
  'astro',
  'electron',
  'react',
  'typescript',
  'sqlite',
  'ai',
  'agent',
  'vue',
  'vite',
  'python',
] as const

export type TechTag = (typeof TECH_TAGS)[number]

export const PROJECT_STATUS = ['ongoing', 'completed', 'paused'] as const
export type ProjectStatus = (typeof PROJECT_STATUS)[number]

/** 展示用标签：内容里存 ASCII id，渲染时经此映射，避免在页面里散落字符串 */
export const TECH_TAG_LABELS: Record<TechTag, string> = {
  astro: 'Astro',
  electron: 'Electron',
  react: 'React',
  typescript: 'TypeScript',
  sqlite: 'SQLite',
  ai: 'AI',
  agent: 'Agent',
  vue: 'Vue',
  vite: 'Vite',
  python: 'Python',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ongoing: '进行中',
  completed: '已完成',
  paused: '暂停',
}

export const POST_TOPICS = ['ai', 'agent', 'frontend', 'backend', 'hardware', 'notes'] as const
export type PostTopic = (typeof POST_TOPICS)[number]

export const POST_TAGS = [
  'astro', 'electron', 'react', 'typescript', 'sqlite', 'ai', 'agent', 'vue', 'vite', 'python',
] as const
export type PostTag = (typeof POST_TAGS)[number]

export const PART_CATEGORIES = [
  'cpu', 'motherboard', 'memory', 'gpu', 'storage', 'cooling', 'case', 'power-supply', 'other',
] as const
export type PartCategory = (typeof PART_CATEGORIES)[number]

export const PARAMETER_TARGETS = ['cpu', 'memory', 'gpu'] as const
export type ParameterTarget = (typeof PARAMETER_TARGETS)[number]
