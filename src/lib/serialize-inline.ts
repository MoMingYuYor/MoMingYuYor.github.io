/**
 * 内联脚本里的 JSON 安全序列化：转义会提前终止 `<script>` 或干扰 HTML 解析的字符。
 * 调用点必须保证传入值已经过校验；本函数只负责序列化，不承担校验职责。
 */
export function serializeInline(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
