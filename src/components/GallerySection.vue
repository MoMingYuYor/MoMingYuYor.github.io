<script setup lang="ts" generic="T extends GalleryItem">
import { computed, nextTick, ref, watch } from 'vue'
import { QUERY_DESKTOP, useMediaQuery } from '../composables/useMediaQuery'
import { assetUrl } from '../lib/assets'
import { normalizeActiveId, selectAfterRemoval, stepIndex, tabStepFromKey, withFailedUrl } from '../lib/gallery'
import type { GalleryItem, ImageAsset } from '../types/content'

const props = defineProps<{
  /** 章节锚点 id（interests / projects），同时用作 DOM id 前缀避免重名冲突 */
  sectionId: string
  number: string
  heading: string
  intro: string
  /** 侧栏引文，可选；展示在标签列表底部（移动端在横滚列表下方） */
  aside?: string
  items: T[]
  /**
   * 展示变体（方案 5.1）：只决定选项外观、主图比例与辅助说明位置，
   * 选中、键盘与失败处理仍共用同一套状态实现。
   */
  variant: 'interest' | 'project'
}>()

defineSlots<{
  details?: (props: { item: T }) => unknown
}>()

const isDesktop = useMediaQuery(QUERY_DESKTOP)

/* 选项缩略图（方案 5.1）：兴趣移动端为纯文字主题条，其余显示缩略图；
   项目用 64x40（参数表 48–64px 档取上限），兴趣桌面沿用 T3 的 72x48（64–80px 档） */
const showTabThumb = computed(() => props.variant === 'project' || isDesktop.value)
const tabThumbSize = computed(() =>
  props.variant === 'project' ? { width: 64, height: 40 } : { width: 72, height: 48 },
)

/** 照片焦点裁切（方案 5.1）：按断点取 object-position；未配置时保持浏览器默认居中 */
function frameImageStyle(image: ImageAsset) {
  const position = isDesktop.value ? image.desktopPosition : image.mobilePosition
  return position ? { objectPosition: position } : undefined
}

const activeId = ref<string | null>(normalizeActiveId(props.items, null))

/* 数据更新时回退激活项：删除当前项优先选原位置的下一项，末尾则选前一项 */
watch(
  () => props.items,
  (next, prev) => {
    if (!prev) return
    const removedIndex = prev.findIndex((p) => !next.some((n) => n.id === p.id))
    if (removedIndex !== -1 && prev[removedIndex].id === activeId.value) {
      activeId.value = selectAfterRemoval(next, removedIndex)
    } else {
      activeId.value = normalizeActiveId(next, activeId.value)
    }
  },
)

const activeIndex = computed(() => props.items.findIndex((item) => item.id === activeId.value))

/* 图片失败状态按资源 URL 记录：主图与同 URL 缩略图共享；切换其他图片不继承，换 URL 即可重新加载 */
const failedUrls = ref<ReadonlySet<string>>(new Set())

function markFailed(url: string) {
  console.warn(`画廊图片加载失败，已显示主题色占位（资源：${url}）`)
  failedUrls.value = withFailedUrl(failedUrls.value, url)
}

/* 激活项变化后把选中标签滚入选择器可见区域：block/inline 均取 nearest，只滚选择器不拉整页 */
watch(activeId, async (next) => {
  if (!next || props.items.length < 2) return
  await nextTick()
  document.getElementById(tabId(next))?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function tabId(id: string) {
  return `${props.sectionId}-tab-${id}`
}

function panelId(id: string) {
  return `${props.sectionId}-panel-${id}`
}

/** 桌面竖向标签用上下方向键，移动横向标签用左右方向键；边界循环，每次只显示激活面板 */
function onKeydown(event: KeyboardEvent) {
  const orientation = isDesktop.value ? 'vertical' : 'horizontal'
  const step = tabStepFromKey(event.key, orientation)
  if (!step || props.items.length === 0) return
  event.preventDefault()
  const index = stepIndex(Math.max(activeIndex.value, 0), props.items.length, step)
  const item = props.items[index]
  if (!item) return
  activeId.value = item.id
  nextTick(() => document.getElementById(tabId(item.id))?.focus())
}
</script>

<template>
  <section
    :id="sectionId"
    class="gallery-section section-block"
    :class="`gallery-section--${variant}`"
    :aria-labelledby="`${sectionId}-heading`"
  >
    <div class="container">
      <header class="section-head">
        <div class="section-head-row">
          <span class="section-kicker-dash" aria-hidden="true"></span>
          <p class="section-number" aria-hidden="true">{{ number }}</p>
          <span class="section-kicker-sep" aria-hidden="true">/</span>
          <h2 :id="`${sectionId}-heading`" tabindex="-1" class="section-heading">{{ heading }}</h2>
        </div>
        <p class="section-intro">{{ intro }}</p>
      </header>

      <div class="gallery">
        <!-- 侧栏（标签栏 + 引文）在面板之前进入 DOM：Tab 键从激活标签可达面板内容 -->
        <div class="gallery-side">
          <div
            v-if="items.length > 1"
            class="gallery-tabs"
            role="tablist"
            :aria-orientation="isDesktop ? 'vertical' : undefined"
            :aria-label="`${heading}条目`"
            @keydown="onKeydown"
          >
            <button
              v-for="item in items"
              :id="tabId(item.id)"
              :key="item.id"
              type="button"
              class="gallery-tab"
              role="tab"
              :aria-selected="item.id === activeId"
              :aria-controls="panelId(item.id)"
              :tabindex="item.id === activeId ? 0 : -1"
              @click="activeId = item.id"
            >
              <!-- 缩略图失败占位：与图片同尺寸的主题色块，不出现破损图标；
                   兴趣移动端不渲染缩略图（纯文字主题条） -->
              <img
                v-if="showTabThumb && !failedUrls.has(item.image.src)"
                class="gallery-tab-thumb"
                :src="assetUrl(item.image.src)"
                alt=""
                :width="tabThumbSize.width"
                :height="tabThumbSize.height"
                loading="lazy"
                decoding="async"
                @error="markFailed(item.image.src)"
              />
              <span
                v-else-if="showTabThumb"
                class="gallery-tab-thumb-fallback"
                aria-hidden="true"
              ></span>
              <span class="gallery-tab-name">{{ item.title }}</span>
              <span class="gallery-tab-summary">{{ item.summary }}</span>
              <span class="gallery-tab-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <!-- 引文位置由 variant 决定（5.1）：项目与兴趣桌面在侧栏列表底部；
               兴趣移动端渲染在主内容之后（见 .gallery 内尾部引文） -->
          <p v-if="aside && (variant === 'project' || isDesktop)" class="gallery-aside">{{ aside }}</p>
        </div>

        <!-- 面板全部渲染、仅显示激活项：图片与文字同处一个内容区域，隐藏面板不可聚焦，aria-controls 不悬空 -->
        <div v-if="items.length > 0" class="gallery-main">
          <div
            v-for="item in items"
            v-show="item.id === activeId"
            :id="panelId(item.id)"
            :key="item.id"
            class="gallery-panel"
            :role="items.length > 1 ? 'tabpanel' : undefined"
            :aria-labelledby="items.length > 1 ? tabId(item.id) : undefined"
            :tabindex="item.publishedUrl || item.sourceUrl ? undefined : 0"
          >
            <figure class="gallery-media">
              <!-- 内层框负责比例与裁剪；失败时显示固定比例主题色占位与替代文本 -->
              <div class="gallery-frame" :class="`is-${item.image.kind}`">
                <img
                  v-if="!failedUrls.has(item.image.src)"
                  :src="assetUrl(item.image.src)"
                  :alt="item.image.alt"
                  :width="item.image.width"
                  :height="item.image.height"
                  :style="frameImageStyle(item.image)"
                  loading="lazy"
                  decoding="async"
                  @error="markFailed(item.image.src)"
                />
                <p v-else class="media-fallback">{{ item.image.alt }}</p>
              </div>
            </figure>

            <div class="gallery-title-row">
              <h3 class="gallery-title">{{ item.title }}</h3>
              <!-- 装饰长箭头，仅桌面显示 -->
              <svg
                class="gallery-title-arrow"
                aria-hidden="true"
                viewBox="0 0 44 12"
                width="44"
                height="12"
                fill="none"
              >
                <line x1="0" y1="6" x2="40" y2="6" stroke="currentColor" stroke-width="1.5" />
                <path d="M34 1 L42 6 L34 11" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </div>
            <p class="gallery-summary">{{ item.summary }}</p>
            <slot name="details" :item="item" />
          </div>
        </div>

        <!-- 兴趣移动端引文：手机优先顺序为主题条→主图→短说明→装饰引文（5.1），故排在主内容之后 -->
        <p v-if="aside && variant === 'interest' && !isDesktop" class="gallery-aside">{{ aside }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  display: grid;
  gap: 32px;
}

/* grid 子项默认 min-width:auto 会被横滚标签栏的最大内容宽度撑出页面，显式归零 */
.gallery-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.gallery-main {
  min-width: 0;
}

/* 侧栏引文：顶部细分隔线 + 衬线体，前后补中文引号 */
.gallery-aside {
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.8;
  color: var(--text-secondary);
}

.gallery-aside::before {
  content: '“';
}

.gallery-aside::after {
  content: '”';
}

.gallery-media {
  /* 面板已包含主图：图片与标题的间距由媒体底部承担，面板自身不再留白 */
  margin: 0 0 24px;
}

.gallery-frame {
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface-bg);
  /* 主图比例由 variant 决定（5.1）：兴趣照片与项目封面/截图当前同取 16/10；截图类媒体在下方 contain 完整显示 */
  aspect-ratio: 16 / 10;
}

.gallery-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 截图类媒体完整显示保全边缘信息，周围填充次级表面色 */
.gallery-frame.is-screenshot img {
  object-fit: contain;
  padding: 24px;
}

.media-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  margin: 0;
  padding: 16px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: center;
}

.gallery-panel {
  min-width: 0;
}

.gallery-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.gallery-title {
  font-family: var(--font-serif);
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.gallery-title-arrow {
  display: none;
  flex: 0 0 auto;
  color: var(--accent);
}

.gallery-summary {
  margin-top: 8px;
  max-width: 42em;
  color: var(--text-secondary);
}

.gallery-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px;
  margin: -4px;
  scroll-snap-type: x proximity;
  /* 窄屏横滚：两端渐隐提示可滚动，桌面移除 */
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
}

.gallery-tab {
  display: grid;
  /* 缩略图 64–80px 档：72px 宽在窄屏卡片里给标题留出两行空间（兴趣桌面沿用；项目见下方 variant 覆盖） */
  grid-template-columns: 72px minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  column-gap: 16px;
  align-items: center;
  text-align: left;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
  /* 窄屏横向滚动条：固定卡片宽度，避免文字列被压缩成逐字换行 */
  flex: 0 0 auto;
  width: 272px;
  scroll-snap-align: start;
}

.gallery-tab-thumb {
  grid-row: 1 / 3;
  width: 72px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--surface-bg);
}

/* 缩略图失败占位：与正常缩略图同尺寸同观感（无边框、同底色），失败态由主内容区占位承担 */
.gallery-tab-thumb-fallback {
  display: block;
  grid-row: 1 / 3;
  width: 72px;
  height: 48px;
  border-radius: 4px;
  background: var(--surface-bg);
}

/* 条目标题允许两行：点击前可辨认主题或作品名，完整标题仍在主内容区显示 */
.gallery-tab-name {
  grid-column: 2;
  grid-row: 1;
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.45;
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.gallery-tab-summary {
  grid-column: 2;
  grid-row: 2;
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 卡片右端装饰箭头：默认透明，hover 或选中时显示强调色 */
.gallery-tab-arrow {
  grid-column: 3;
  grid-row: 1 / 3;
  color: transparent;
  transition: color 160ms ease;
}

.gallery-tab:hover .gallery-tab-arrow,
.gallery-tab[aria-selected='true'] .gallery-tab-arrow {
  color: var(--accent);
}

/* 选中项：细强调边框 + 表面底色，不单独依赖颜色 */
.gallery-tab[aria-selected='true'] {
  border-color: var(--accent);
  background: var(--surface-bg);
}

/* ── variant 外观分支（5.1）────────────────────────────────────────
   variant 只影响选项外观：缩略图尺寸、卡片宽度、文字条；键盘/选中/失败处理样式共用。 */

/* 项目：参数表“作品使用 48–64px 缩略图”取 64x40（与主图 16/10 同比例） */
.gallery-section--project .gallery-tab {
  grid-template-columns: 64px minmax(0, 1fr) auto;
}

.gallery-section--project .gallery-tab-thumb,
.gallery-section--project .gallery-tab-thumb-fallback {
  width: 64px;
  height: 40px;
}

@media (max-width: 1023px) {
  /* 项目手机端：紧凑选择器，卡片比兴趣窄屏档更窄 */
  .gallery-section--project .gallery-tab {
    width: 248px;
  }

  /* 兴趣手机端：纯文字主题条——不渲染缩略图（模板按 isDesktop 分支），单行主题名 + 装饰箭头 */
  .gallery-section--interest .gallery-tab {
    grid-template-columns: minmax(0, 1fr) auto;
    width: auto;
    max-width: 72vw;
    padding: 12px 16px;
    column-gap: 10px;
  }

  .gallery-section--interest .gallery-tab-name {
    grid-column: 1;
    grid-row: 1;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gallery-section--interest .gallery-tab-summary {
    display: none;
  }

  .gallery-section--interest .gallery-tab-arrow {
    grid-column: 2;
    grid-row: 1;
  }
}

@media (min-width: 1024px) {
  /* 桌面：主预览约 68%，右侧列表约 28%，中间留出稳定间距；
     侧栏 DOM 在前（Tab 序），视觉上仍放右侧 */
  .gallery {
    grid-template-columns: minmax(0, 68fr) minmax(0, 28fr);
    align-items: start;
  }

  .gallery-main {
    grid-column: 1;
    grid-row: 1;
  }

  .gallery-side {
    grid-column: 2;
    grid-row: 1;
    /* 与主图等高时引文沉到列表底部；撑不起来则退回普通流 */
    height: 100%;
  }

  .gallery-aside {
    margin-top: auto;
  }

  .gallery-tabs {
    flex-direction: column;
    overflow: visible;
    -webkit-mask-image: none;
    mask-image: none;
  }

  .gallery-tab {
    width: auto;
  }

  .gallery-title-arrow {
    display: block;
  }
}
</style>
