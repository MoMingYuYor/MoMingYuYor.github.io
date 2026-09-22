import { describe, expect, it } from 'vitest'

import {
  formatDeviceDate,
  formatMonthDay,
  formatWeekday,
  formatYear,
  greetingFor,
  isoDate,
} from '../../src/lib/datetime'

/** 用本地时间构造，避免测试依赖运行机器的时区偏移 */
const september9 = new Date(2026, 8, 9, 9, 0, 0)

describe('isoDate', () => {
  it('输出 yyyy-mm-dd 并对个位数补零', () => {
    expect(isoDate(september9)).toBe('2026-09-09')
    expect(isoDate(new Date(2026, 11, 31, 23, 59, 0))).toBe('2026-12-31')
    expect(isoDate(new Date(2027, 0, 1, 0, 1, 0))).toBe('2027-01-01')
  })
})

describe('formatMonthDay', () => {
  it('输出月 / 日两段并补零', () => {
    expect(formatMonthDay(september9)).toBe('09 / 09')
    expect(formatMonthDay(new Date(2026, 11, 25, 12, 0, 0))).toBe('12 / 25')
  })
})

describe('formatYear', () => {
  it('输出四位年份', () => {
    expect(formatYear(september9)).toBe('2026')
  })
})

describe('formatWeekday / formatDeviceDate', () => {
  it('按显式传入的 locale 输出非空文本', () => {
    const weekday = formatWeekday(september9, 'zh-CN')
    const full = formatDeviceDate(september9, 'zh-CN')
    expect(weekday.length).toBeGreaterThan(0)
    expect(full).toContain('2026')
  })

  it('不同日期的星期名不同', () => {
    const saturday = formatWeekday(new Date(2026, 8, 19, 12, 0, 0), 'zh-CN')
    const sunday = formatWeekday(new Date(2026, 8, 20, 12, 0, 0), 'zh-CN')
    expect(saturday).not.toBe(sunday)
  })
})

describe('greetingFor', () => {
  it('覆盖各时段边界', () => {
    expect(greetingFor(0)).toBe('夜深了')
    expect(greetingFor(4)).toBe('夜深了')
    expect(greetingFor(5)).toBe('早上好')
    expect(greetingFor(11)).toBe('早上好')
    expect(greetingFor(12)).toBe('下午好')
    expect(greetingFor(17)).toBe('下午好')
    expect(greetingFor(18)).toBe('晚上好')
    expect(greetingFor(23)).toBe('晚上好')
  })
})
