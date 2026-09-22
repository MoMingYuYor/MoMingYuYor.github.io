/**
 * 主题纯规则：首帧引导脚本、主题控件与页面都只消费本模块，不各自重写判定逻辑。
 * 存储键与三态语义沿用既有站点（`personal-home:theme` + system/light/dark），
 * 迁移后不改变含义，否则访客已有的偏好会失效。
 */

export type Theme = 'light' | 'dark'
export type ThemePreference = 'system' | Theme

export const THEME_STORAGE_KEY = 'personal-home:theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/**
 * 从存储读取偏好。非法值与读取异常（隐私模式、存储被禁用、getter 抛错）
 * 都退回 'system'，让页面仍能落到可用主题。
 * getter 以参数注入，便于在没有 DOM 的测试里模拟存储拒绝。
 */
export function readStoredPreference(get: (key: string) => string | null): ThemePreference {
  try {
    const stored = get(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** 有效主题：只有偏好为 'system' 时才跟随系统外观 */
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): Theme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light'
  return preference
}
