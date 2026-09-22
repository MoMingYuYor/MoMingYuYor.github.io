<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useTheme } from '../composables/useTheme'
import { QUERY_DESKTOP, useMediaQuery } from '../composables/useMediaQuery'
import ThemeSwitch from './ThemeSwitch.vue'

interface NavSection {
  id: string
  label: string
}

defineProps<{ sections: NavSection[]; activeSectionId?: string }>()

const { effectiveTheme } = useTheme()
/* 品牌位展示当前主题标签（暮色/晴光），呼应双主题设计；窄屏使用紧凑短标签 */
const themeLabel = computed(() => (effectiveTheme.value === 'dark' ? '暮色 / DARK' : '晴光 / LIGHT'))
const themeCompactLabel = computed(() => (effectiveTheme.value === 'dark' ? '暮色' : '晴光'))

/* 主题控件已改为单按钮循环切换（无面板），header 只掌握导航面板的展开状态 */
const navOpen = ref(false)

const scrolled = ref(false)
const navTriggerRef = ref<HTMLButtonElement | null>(null)
const siteNavRef = ref<HTMLElement | null>(null)
const isDesktop = useMediaQuery(QUERY_DESKTOP)

/* 滚动标记经 rAF 合帧，避免滚动事件高频触发响应式写入 */
let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    scrolled.value = window.scrollY > 24
    ticking = false
  })
}

window.addEventListener('scroll', onScroll, { passive: true })
onScroll()
onScopeDispose(() => window.removeEventListener('scroll', onScroll))

function focusSectionHeading(sectionId: string) {
  document.getElementById(`${sectionId}-heading`)?.focus({ preventScroll: true })
}

/**
 * 移动菜单选择锚点：关闭菜单并把焦点移至对应章节标题，不留在已隐藏菜单中。
 * 焦点时机挂在 hashchange（锚点激活完成）之后：可信点击的微任务里读
 * location.hash 仍是旧值，且过早聚焦会被随后的锚点行为重置。
 */
function onNavClick(sectionId: string) {
  if (!navOpen.value) return
  navOpen.value = false
  if (window.location.hash === `#${sectionId}`) {
    // 同锚点重复点击不触发 hashchange；但锚点默认动作仍会把焦点重置回 body
    //（与 hashchange 路径同一现象），因此延迟到默认动作之后的宏任务再聚焦
    window.setTimeout(() => focusSectionHeading(sectionId), 0)
    return
  }
  const controller = new AbortController()
  window.addEventListener(
    'hashchange',
    () => focusSectionHeading(sectionId),
    { once: true, signal: controller.signal },
  )
  // 导航被取消等未触发 hashchange 的场景下兜底清理监听
  window.setTimeout(() => controller.abort(), 2000)
}

function onNavToggle() {
  navOpen.value = !navOpen.value
}

/* 打开导航面板后（nextTick）聚焦第一个可见章节链接 */
watch(navOpen, async (open) => {
  if (!open) return
  await nextTick()
  siteNavRef.value?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true })
})

function onEscape() {
  if (navOpen.value) {
    navOpen.value = false
    navTriggerRef.value?.focus()
  }
}

/* 点击导航面板与触发器之外的区域关闭；不主动移焦，让外部点击的自然落点获得焦点 */
function onDocPointerDown(event: PointerEvent) {
  if (!navOpen.value) return
  const target = event.target
  const insideNav =
    target instanceof Node &&
    (target === navTriggerRef.value || siteNavRef.value?.contains(target) === true)
  if (insideNav) return
  navOpen.value = false
}
document.addEventListener('pointerdown', onDocPointerDown)
onScopeDispose(() => document.removeEventListener('pointerdown', onDocPointerDown))

/*
 * 断点切换焦点修复：聚焦元素被 CSS 隐藏时浏览器把焦点“修复”到 body，
 * 且 matchMedia change 事件在该修复之后才触发（实测 focusout relatedTarget 为空是唯一线索）。
 * 仅记录导航 UI（触发器与面板链接）内焦点因隐藏落回 body，跨断点后转到新断点的可见入口：
 * 到桌面聚焦导航首个链接，到窄屏聚焦菜单触发器。
 */
let navFocusLostToBody = false
function onHeaderFocusOut(event: FocusEvent) {
  const el = event.target
  const inNav =
    el instanceof Node &&
    (el === navTriggerRef.value || siteNavRef.value?.contains(el) === true)
  navFocusLostToBody = inNav && event.relatedTarget === null
}
function onHeaderFocusIn() {
  navFocusLostToBody = false
}
/* 指针抬起代表焦点变化源于点击，而非隐藏修复 */
function onDocPointerUp() {
  navFocusLostToBody = false
}
document.addEventListener('pointerup', onDocPointerUp)
onScopeDispose(() => document.removeEventListener('pointerup', onDocPointerUp))

watch(isDesktop, async (desktop) => {
  const shouldRestore = navFocusLostToBody || document.activeElement === navTriggerRef.value
  navFocusLostToBody = false
  // 跨断点一律清除手机展开状态
  navOpen.value = false
  if (!shouldRestore) return
  await nextTick()
  if (desktop) {
    siteNavRef.value?.querySelector<HTMLAnchorElement>('a[href]')?.focus({ preventScroll: true })
  } else {
    navTriggerRef.value?.focus({ preventScroll: true })
  }
})
</script>

<template>
  <header
    class="site-header"
    :class="{ 'is-scrolled': scrolled, 'is-nav-open': navOpen }"
    @keydown.escape="onEscape"
    @focusout="onHeaderFocusOut"
    @focusin="onHeaderFocusIn"
  >
    <div class="header-inner container">
      <!-- 品牌位保留原生锚点行为：外部 pointerdown 已先关面板，onNavClick 的 guard 会直接返回 -->
      <a class="brand" href="#home">
        <span class="brand-full">{{ themeLabel }}</span>
        <span class="brand-compact">{{ themeCompactLabel }}</span>
      </a>

      <nav id="site-nav" ref="siteNavRef" class="site-nav" aria-label="站点导航">
        <ul class="nav-list">
          <li v-for="section in sections" :key="section.id">
            <a
              class="nav-link"
              :href="`#${section.id}`"
              :aria-current="section.id === activeSectionId ? 'location' : undefined"
              @click="onNavClick(section.id)"
            >{{ section.label }}</a>
          </li>
        </ul>
      </nav>

      <div class="header-actions">
        <ThemeSwitch />
        <button
          ref="navTriggerRef"
          type="button"
          class="nav-toggle"
          :aria-expanded="navOpen"
          aria-controls="site-nav"
          @click="onNavToggle"
        >
          <span class="visually-hidden">{{ navOpen ? '关闭导航菜单' : '打开导航菜单' }}</span>
          <span aria-hidden="true" class="nav-toggle-icon">{{ navOpen ? '✕' : '☰' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: fixed;
  inset-inline: 0;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid transparent;
  transition: background-color 240ms ease, border-color 240ms ease;
}

/* 首屏上低干扰透明；进入正文或导航菜单展开后提供足够不透明的主题背景 */
.site-header.is-scrolled,
.site-header.is-nav-open {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  backdrop-filter: blur(16px) saturate(1.15);
  border-bottom-color: var(--border);
}

/* 不支持背景模糊时退回不透明底色，保证导航文字对比度 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .site-header.is-scrolled,
  .site-header.is-nav-open {
    background: var(--surface-bg);
  }
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: var(--header-height);
}

.brand {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.18em;
  color: var(--text-primary);
  text-decoration: none;
  padding: 8px 0;
  white-space: nowrap;
}

/* 窄屏使用紧凑品牌（暮色/晴光），不缩小触摸目标 */
.brand-compact {
  display: none;
}

.nav-list {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  position: relative;
  padding: 10px 14px;
  min-height: 44px;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 6px;
  transition: color 160ms ease;
}

.nav-link:hover {
  color: var(--text-primary);
}

/*
 * 当前章节指示（aria-current="location"）：颜色加深 + 底部短线。
 * 只改颜色与伪元素，不动盒模型，避免指示切换时导航布局抖动；
 * 桌面平铺导航与窄屏展开菜单共用同一 .nav-link，指示同时生效。
 */
.nav-link[aria-current='location'] {
  color: var(--text-primary);
}

.nav-link[aria-current='location']::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 6px;
  width: 16px;
  height: 2px;
  border-radius: 1px;
  transform: translateX(-50%);
  background: var(--accent);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.nav-toggle-icon {
  font-size: 1.125rem;
  line-height: 1;
}

@media (max-width: 1023px) {
  .header-actions {
    /* 320px 契约：两个入口之间 8px，各保持 44×44 */
    gap: 8px;
  }

  .brand-full {
    display: none;
  }

  .brand-compact {
    display: inline;
  }

  .nav-toggle {
    display: inline-flex;
  }

  .site-nav {
    position: absolute;
    top: var(--header-height);
    left: 0;
    right: 0;
    display: none;
    padding: 8px clamp(1rem, 4vw, 5rem) 16px;
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    backdrop-filter: blur(16px) saturate(1.15);
    border-bottom: 1px solid var(--border);
  }

  .site-header.is-nav-open .site-nav {
    display: block;
  }

  .nav-list {
    flex-direction: column;
    gap: 2px;
  }

  .nav-link {
    width: 100%;
  }
}
</style>
