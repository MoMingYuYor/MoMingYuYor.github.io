<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme'
import type { ThemePreference } from '../types/content'

/*
 * 单按钮循环切换：跟随系统 → 浅色 → 深色 → 跟随系统。
 * 图标随当前偏好变化（◐/☀/☾ 的 SVG 版本），aria-label 与 title
 * 同时说明当前档与点击后的下一档，不依赖图标单独传达状态。
 */
const { preference, setPreference } = useTheme()

const ORDER: ThemePreference[] = ['system', 'light', 'dark']

const OPTION_LABEL: Record<ThemePreference, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

const currentIndex = computed(() => {
  const index = ORDER.indexOf(preference.value)
  return index === -1 ? 0 : index
})

const currentOption = computed(() => ORDER[currentIndex.value]!)
const nextOption = computed(() => ORDER[(currentIndex.value + 1) % ORDER.length]!)

const triggerLabel = computed(
  () => `主题偏好：${OPTION_LABEL[currentOption.value]}，点击切换为${OPTION_LABEL[nextOption.value]}`,
)

function onToggle() {
  setPreference(nextOption.value)
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="triggerLabel"
    :title="triggerLabel"
    @click="onToggle"
  >
    <!-- 跟随系统：半填充圆 -->
    <svg
      v-if="currentOption === 'system'"
      viewBox="0 0 24 24"
      aria-hidden="true"
      class="theme-toggle-icon"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" class="is-fill" />
    </svg>
    <!-- 浅色：太阳 -->
    <svg v-else-if="currentOption === 'light'" viewBox="0 0 24 24" aria-hidden="true" class="theme-toggle-icon">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
    </svg>
    <!-- 深色：月亮 -->
    <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="theme-toggle-icon">
      <path d="M20.6 13.1A8.5 8.5 0 1 1 10.9 3.4a6.8 6.8 0 0 0 9.7 9.7z" />
    </svg>
  </button>
</template>

<style scoped>
/* 两个断点共用同一形态：44px 单图标按钮（触摸目标契约），按钮常驻可见，
   不再有面板与隐藏态，断点切换不产生焦点丢失 */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease;
}

.theme-toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.theme-toggle-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.theme-toggle-icon .is-fill {
  fill: currentColor;
  stroke: none;
}
</style>
