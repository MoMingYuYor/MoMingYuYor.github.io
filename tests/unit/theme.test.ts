// 主题偏好纯逻辑单测：对应 src/lib/theme.ts 的导出契约
import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  type ThemePreference,
} from '../../src/lib/theme'

describe('THEME_STORAGE_KEY', () => {
  it('存储键为约定的 personal-home:theme', () => {
    expect(THEME_STORAGE_KEY).toBe('personal-home:theme')
  })
})

describe('resolveTheme', () => {
  it("偏好为 'system' 且系统深色时解析为 dark", () => {
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it("偏好为 'system' 且系统浅色时解析为 light", () => {
    expect(resolveTheme('system', false)).toBe('light')
  })

  it("偏好为 'light' 时优先于系统设置", () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it("偏好为 'dark' 时优先于系统设置", () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readStoredPreference', () => {
  it('存储值为合法枚举时原样采用', () => {
    expect(readStoredPreference(() => 'system')).toBe('system')
    expect(readStoredPreference(() => 'light')).toBe('light')
    expect(readStoredPreference(() => 'dark')).toBe('dark')
  })

  it("存储值为非法值 'blue' 时回退为 system", () => {
    expect(readStoredPreference(() => 'blue')).toBe('system')
  })

  it('存储值为 null 时回退为 system', () => {
    expect(readStoredPreference(() => null)).toBe('system')
  })

  it('getter 抛异常时回退为 system 且不向外抛错', () => {
    const get = (_key: string): string | null => {
      throw new Error('localStorage 被禁用')
    }
    expect(readStoredPreference(get)).toBe('system')
  })
})

describe('isThemePreference', () => {
  it('接受 system/light/dark 三个合法值', () => {
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
  })

  it('拒绝非法输入（含大小写差异与非字符串）', () => {
    expect(isThemePreference('blue')).toBe(false)
    expect(isThemePreference('SYSTEM')).toBe(false)
    expect(isThemePreference('')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
    expect(isThemePreference(undefined)).toBe(false)
    expect(isThemePreference(0)).toBe(false)
    expect(isThemePreference(true)).toBe(false)
    expect(isThemePreference({})).toBe(false)
  })

  it('作为类型守卫收窄 unknown 值', () => {
    const value: unknown = 'dark'
    if (isThemePreference(value)) {
      // 类型层面验证：收窄后可直接赋给 ThemePreference
      const preference: ThemePreference = value
      expect(preference).toBe('dark')
    } else {
      throw new Error('合法值不应被类型守卫拒绝')
    }
  })
})
