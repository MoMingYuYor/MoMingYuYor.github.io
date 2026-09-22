import { computed, getCurrentScope, onScopeDispose, ref, watchEffect } from 'vue'
import type { Ref } from 'vue'
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
} from '../lib/theme'
import type { Theme, ThemePreference } from '../types/content'

export interface ThemeController {
  /** 用户偏好：跟随系统 / 浅色 / 深色 */
  preference: Ref<ThemePreference>
  /** 有效主题：由偏好与系统外观解析，只有 light | dark */
  effectiveTheme: Ref<Theme>
  setPreference: (next: ThemePreference) => void
}

let controller: ThemeController | null = null

/**
 * App 只建立一个主题控制实例并向子组件传递（模块级单例）。
 * 职责：偏好状态、持久化、监听系统外观变化、把有效主题写入根元素。
 */
export function useTheme(): ThemeController {
  if (controller) return controller

  function readStored(): ThemePreference {
    try {
      return readStoredPreference((key) => window.localStorage.getItem(key))
    } catch {
      return 'system'
    }
  }

  const preference = ref<ThemePreference>(readStored())

  const darkQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  const systemIsDark = ref(darkQuery?.matches ?? false)

  const onSystemChange = (event: MediaQueryListEvent) => {
    systemIsDark.value = event.matches
  }
  darkQuery?.addEventListener('change', onSystemChange)
  if (getCurrentScope()) {
    onScopeDispose(() => darkQuery?.removeEventListener('change', onSystemChange))
  }

  const effectiveTheme = computed(() => resolveTheme(preference.value, systemIsDark.value))

  function setPreference(next: ThemePreference) {
    if (!isThemePreference(next)) return
    preference.value = next
    // 写入失败只影响跨会话持久化，当前会话保持刚选的主题
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* 存储被禁用时静默降级 */
    }
  }

  watchEffect(() => {
    const theme = effectiveTheme.value
    document.documentElement.dataset.theme = theme
    document.documentElement.style.setProperty('color-scheme', theme)
  })

  controller = { preference, effectiveTheme, setPreference }
  return controller
}
