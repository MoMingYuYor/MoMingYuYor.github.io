import { describe, expect, it } from 'vitest'

import {
  THEME_STORAGE_KEY,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
} from '../../src/lib/theme'

describe('THEME_STORAGE_KEY', () => {
  it('沿用既有键，避免访客已保存的偏好失效', () => {
    expect(THEME_STORAGE_KEY).toBe('personal-home:theme')
  })
})

describe('isThemePreference', () => {
  it('接受三态取值', () => {
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
  })

  it('拒绝其它取值与非字符串', () => {
    for (const value of ['', 'Dark', 'auto', null, undefined, 0, {}, []]) {
      expect(isThemePreference(value)).toBe(false)
    }
  })
})

describe('readStoredPreference', () => {
  it('读取合法偏好', () => {
    expect(readStoredPreference(() => 'dark')).toBe('dark')
    expect(readStoredPreference(() => 'light')).toBe('light')
    expect(readStoredPreference(() => 'system')).toBe('system')
  })

  it('非法值与空值都退回 system', () => {
    expect(readStoredPreference(() => 'auto')).toBe('system')
    expect(readStoredPreference(() => '')).toBe('system')
    expect(readStoredPreference(() => null)).toBe('system')
  })

  it('存储读取抛错时静默降级，不让页面因隐私模式崩溃', () => {
    expect(
      readStoredPreference(() => {
        throw new Error('存储被禁用')
      }),
    ).toBe('system')
  })

  it('用同一个键查询', () => {
    const keys: string[] = []
    readStoredPreference((key) => {
      keys.push(key)
      return null
    })
    expect(keys).toEqual([THEME_STORAGE_KEY])
  })
})

describe('resolveTheme', () => {
  it('偏好为 system 时跟随系统外观', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('显式偏好压过系统外观', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
