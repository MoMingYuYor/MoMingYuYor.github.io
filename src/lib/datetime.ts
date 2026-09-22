/**
 * 首页身份区的日期与问候规则（移植自 `main:src/lib/datetime.ts`）。
 * 全部为纯函数：locale 由调用点显式传入，模块加载时不求值、不读系统时钟，
 * 因此可以在 Node 环境直接单测。
 */

const pad = (value: number): string => String(value).padStart(2, '0')

/** 本地 ISO 日期（yyyy-mm-dd），供 <time datetime> 使用 */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 面板大字号日期：'09 / 19'（月 / 日，前导零） */
export function formatMonthDay(date: Date): string {
  return `${pad(date.getMonth() + 1)} / ${pad(date.getDate())}`
}

/** 四位年份 */
export function formatYear(date: Date): string {
  return String(date.getFullYear())
}

/** 短星期名（如「周六」）。locale 由调用点显式传入，不推断访客所在地 */
export function formatWeekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}

/** 完整本地日期。locale 由调用点显式传入 */
export function formatDeviceDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

/** 按小时返回问候语（0–23）。边界：5 点前为深夜，12 点前为早上，18 点前为下午 */
export function greetingFor(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}
