import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

/** 与样式断点保持一致的主要断点 */
export const QUERY_NARROW = '(max-width: 640px)'
export const QUERY_DESKTOP = '(min-width: 1024px)'

/** 响应式媒体查询状态；缺少 matchMedia 时安全降级为 false */
export function useMediaQuery(query: string): Ref<boolean> {
  const mediaList =
    typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const matches = ref(mediaList?.matches ?? false)

  const onChange = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  mediaList?.addEventListener('change', onChange)
  if (getCurrentScope()) {
    onScopeDispose(() => mediaList?.removeEventListener('change', onChange))
  }
  return matches
}
