/** 设备本地日期格式化：不推断访客所在地或时区，locale 交由运行环境决定 */
export function formatDeviceDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

/** 本地 ISO 日期（yyyy-mm-dd），供 <time datetime> 使用 */
export function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 按小时返回问候语 */
export function greetingFor(hour: number): string {
  if (hour < 5) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 面板大字号日期：'09 / 19'（月 / 日，前导零） */
export function formatMonthDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)} / ${pad(date.getDate())}`
}

/** 四位年份，供面板大日期旁的小字列 */
export function formatYear(date: Date): string {
  return String(date.getFullYear())
}

/** 短星期名（如'周六'），locale 交由运行环境决定 */
export function formatWeekday(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}
