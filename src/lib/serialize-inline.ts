/**
 * 注入内联脚本的数据最小安全序列化：转义 <、>、&、U+2028、U+2029，
 * 防止 JSON 提前闭合 <script> 标签或被 HTML/JS 解析器误读。
 * value 在调用点保证为已校验的对象（当前仅主题引导 manifest），
 * 不用于嵌入用户文案。
 */
export function serializeInline(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
