import type { Theme, ThemePreference } from '../types/content'

export type { Theme, ThemePreference } from '../types/content'

/** localStorage 存储键：浏览器引导脚本（src/bootstrap）与 useTheme 共用本常量 */
export const THEME_STORAGE_KEY = 'personal-home:theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/**
 * 从存储读取的 getter 中解析偏好；任何非法值或读取异常都退回 'system'。
 * getter 以参数注入，便于在没有 DOM 的单测中模拟存储拒绝。
 */
export function readStoredPreference(get: (key: string) => string | null): ThemePreference {
  try {
    const stored = get(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** 有效主题解析：仅当偏好为 'system' 时响应系统外观变化 */
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): Theme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light'
  return preference
}
