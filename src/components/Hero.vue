<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { site } from '../content/site'
import { useTheme } from '../composables/useTheme'
import { QUERY_NARROW, useMediaQuery } from '../composables/useMediaQuery'
import { assetUrl } from '../lib/assets'
import { formatMonthDay, formatWeekday, formatYear, greetingFor, isoDate } from '../lib/datetime'
import { selectHeroAsset } from '../lib/hero-source'
import type { SelectedHeroAsset } from '../lib/hero-source'
import type { ContactLink, ImageAsset, Theme } from '../types/content'

const identity = site.identity
const heroContent = site.hero
/* 首屏社交入口取内容源中的已核验联系方式；缺失时整组不渲染 */
const socialLinks = site.contacts

const { effectiveTheme } = useTheme()
const isNarrow = useMediaQuery(QUERY_NARROW)

/* 向下浏览入口指向下一个实际存在的章节：兴趣缺位时依次回退作品与关于 */
const nextSection = (() => {
  if (site.interests.length > 0) return { id: 'interests', label: site.galleries.interests.heading }
  if (site.projects.length > 0) return { id: 'projects', label: site.galleries.projects.heading }
  return { id: 'about', label: site.about.heading }
})()

/* 首屏日期面板：设备本地时间，不由此推断访客所在地或时区 */
const now = ref(new Date())
const timer = window.setInterval(() => {
  now.value = new Date()
}, 30_000)
onScopeDispose(() => window.clearInterval(timer))

const isoDateText = computed(() => isoDate(now.value))
const monthDayText = computed(() => formatMonthDay(now.value))
const yearText = computed(() => formatYear(now.value))
const weekdayText = computed(() => formatWeekday(now.value))
const greeting = computed(() => greetingFor(now.value.getHours()))

/*
 * 首挂载直接提交当前主题资源（fetchpriority=high 交给浏览器）；
 * 切换主题时先预载目标图，加载完成后才换图，失败则保留主题色渐变背景。
 * 为加载任务递增序号，快速连续切换时只有最后一次请求可以提交画面。
 * 资源选择与引导脚本共用 selectHeroAsset：同断点同选择，首次加载只请求一张。
 */
function toCommitted(theme: Theme): SelectedHeroAsset<ImageAsset> {
  return selectHeroAsset(heroContent, theme, isNarrow.value)
}

const committed = ref<SelectedHeroAsset<ImageAsset>>(toCommitted(effectiveTheme.value))
const pending = ref(false)
const failed = ref(false)
let loadToken = 0

watch(effectiveTheme, (theme) => {
  const token = ++loadToken
  pending.value = true
  failed.value = false
  const selected = toCommitted(theme)
  const probe = new Image()
  probe.onload = () => {
    if (token !== loadToken) return
    committed.value = selected
    pending.value = false
  }
  probe.onerror = () => {
    if (token !== loadToken) return
    pending.value = false
    failed.value = true
    console.warn('首屏壁纸预载失败，保留主题色渐变背景')
  }
  probe.src = assetUrl(selected.key)
})

/* 首挂载直接提交的图片加载失败同样回退到渐变，保证文字可读 */
function onHeroImageError() {
  failed.value = true
  console.warn('首屏壁纸加载失败，已回退为主题色渐变背景')
}

const picturePosition = computed(() =>
  isNarrow.value ? committed.value.asset.mobilePosition ?? '50% 50%' : committed.value.asset.desktopPosition ?? '50% 50%',
)

/* 头像加载失败时隐藏头像，保留身份标识文字 */
const avatarFailed = ref(false)
function onAvatarError() {
  avatarFailed.value = true
  console.warn('头像加载失败，已隐藏头像')
}

function iconOf(contact: ContactLink): NonNullable<ContactLink['icon']> {
  return contact.icon ?? 'link'
}
</script>

<template>
  <section id="home" class="hero" aria-labelledby="home-heading">
    <div class="hero-media" aria-hidden="true">
      <Transition name="hero-fade">
        <picture v-if="!pending && !failed" :key="committed.theme" class="hero-picture">
          <source
            v-if="committed.asset.mobileSrc"
            media="(max-width: 640px)"
            :srcset="assetUrl(committed.asset.mobileSrc)"
          />
          <img
            class="hero-img"
            :src="assetUrl(committed.asset.src)"
            alt=""
            :width="committed.asset.width"
            :height="committed.asset.height"
            :style="{ objectPosition: picturePosition }"
            fetchpriority="high"
            decoding="async"
            @error="onHeroImageError"
          />
        </picture>
      </Transition>
      <div class="hero-veil"></div>
    </div>

    <div class="hero-inner container">
      <div class="hero-text">
        <div class="hero-eyebrow">
          <img
            v-if="identity.avatar && !avatarFailed"
            class="hero-avatar"
            :src="assetUrl(identity.avatar.src)"
            :alt="identity.avatar.alt"
            :width="identity.avatar.width"
            :height="identity.avatar.height"
            decoding="async"
            @error="onAvatarError"
          />
          <p v-if="identity.eyebrow" class="hero-eyebrow-text">{{ identity.eyebrow }}</p>
        </div>
        <h1 id="home-heading" tabindex="-1" class="hero-name">{{ identity.displayName }}</h1>
        <p v-if="identity.legalName" class="hero-legal-name">{{ identity.legalName }}</p>
        <p class="hero-headline">{{ identity.headline }}</p>
        <p class="hero-intro">{{ identity.introduction }}</p>
        <ul v-if="socialLinks.length" class="hero-social" aria-label="社交入口">
          <li v-for="contact in socialLinks" :key="contact.href">
            <a
              class="hero-social-link"
              :href="contact.href"
              :target="contact.href.startsWith('https://') ? '_blank' : undefined"
              :rel="contact.href.startsWith('https://') ? 'noopener noreferrer' : undefined"
              :aria-label="contact.label"
            >
              <svg v-if="iconOf(contact) === 'github'" viewBox="0 0 24 24" aria-hidden="true" class="hero-social-icon is-fill">
                <path
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              <svg v-else-if="iconOf(contact) === 'mail'" viewBox="0 0 24 24" aria-hidden="true" class="hero-social-icon">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
              <svg v-else-if="iconOf(contact) === 'music'" viewBox="0 0 24 24" aria-hidden="true" class="hero-social-icon">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="hero-social-icon">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </a>
          </li>
        </ul>
      </div>

      <aside class="hero-panel" aria-label="本地日期与问候">
        <p class="hero-panel-greeting">
          {{ heroContent.wish ? `${greeting}，` : greeting }}<template v-if="heroContent.wish"><br />{{ heroContent.wish }}</template>
        </p>
        <div class="hero-panel-divider" role="presentation"></div>
        <div class="hero-panel-date">
          <time class="hero-panel-monthday" :datetime="isoDateText">{{ monthDayText }}</time>
          <p class="hero-panel-datesub">
            <span class="hero-panel-year">{{ yearText }}</span>
            <span class="hero-panel-weekday">{{ weekdayText }}</span>
          </p>
        </div>
        <template v-if="heroContent.quote">
          <div class="hero-panel-divider" role="presentation"></div>
          <p class="hero-panel-quote">&ldquo;{{ heroContent.quote }}&rdquo;</p>
        </template>
      </aside>

      <!-- 向下浏览入口：原生锚点直达下一章节，减少动画偏好下浏览器默认即时跳转 -->
      <a class="hero-scroll" :href="`#${nextSection.id}`" :aria-label="`向下浏览：${nextSection.label}`">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="hero-scroll-icon">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </a>
    </div>

    <p v-if="heroContent.footnote" class="hero-footnote container" aria-hidden="true">
      <span class="hero-footnote-dash"></span>
      <span class="hero-footnote-text">{{ heroContent.footnote }}</span>
    </p>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  /* 动态视口单位配合回退值；内容超出时允许页面自然增高 */
  min-height: 100vh;
  min-height: 100svh;
}

.hero-media {
  position: absolute;
  inset: 0;
  overflow: hidden;
  /* 壁纸未加载或失败时的主题色回退，保证文字始终可读 */
  background: var(--hero-fallback);
}

.hero-picture,
.hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-img {
  object-fit: cover;
}

/* 文字侧的局部遮罩服务于可读性；风景主体区域保持细节 */
.hero-veil {
  position: absolute;
  inset: 0;
  background: var(--hero-veil);
}

.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 480ms ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}

.hero-inner {
  position: relative;
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 60fr) minmax(0, 28fr);
  column-gap: 12%;
  align-items: center;
  align-content: center;
  width: 100%;
  padding-block: calc(var(--header-height) + 48px) 64px;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hero-avatar {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid var(--border);
  object-fit: cover;
  background: var(--surface-bg);
}

.hero-eyebrow-text {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.3em;
  color: var(--text-secondary);
}

.hero-name {
  margin-top: 24px;
  font-family: var(--font-serif);
  font-size: clamp(2.5rem, 7vw, 6rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow-wrap: anywhere;
}

/* 真名小字：紧随大名，作为对外 id 之下的署名层级 */
.hero-legal-name {
  margin-top: 8px;
  font-size: 0.9375rem;
  letter-spacing: 0.24em;
  color: var(--text-secondary);
}

.hero-headline {
  margin-top: 20px;
  font-family: var(--font-serif);
  font-size: clamp(1.375rem, 2.4vw, 2.125rem);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.hero-intro {
  margin-top: 16px;
  max-width: 34em;
  color: var(--text-secondary);
}

.hero-social {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}

.hero-social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  color: var(--text-primary);
  transition: color 160ms ease;
}

.hero-social-link:hover {
  color: var(--accent);
}

.hero-social-icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hero-social-icon.is-fill {
  fill: currentColor;
  stroke: none;
}

.hero-panel {
  justify-self: end;
  width: 100%;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  backdrop-filter: blur(18px) saturate(1.15);
}

/* 浏览器不支持背景模糊时提高底色不透明度，继续保证文字清楚 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hero-panel {
    background: var(--surface-bg);
  }
}

.hero-panel-greeting {
  font-size: 1rem;
  line-height: 1.9;
}

.hero-panel-divider {
  height: 1px;
  margin-block: 20px;
  background: var(--border);
}

.hero-panel-date {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.hero-panel-monthday {
  font-family: var(--font-serif);
  font-size: clamp(2.25rem, 4vw, 3rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

.hero-panel-datesub {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 4px;
}

.hero-panel-year {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  letter-spacing: 0.08em;
}

.hero-panel-weekday {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.hero-panel-quote {
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.9;
  color: var(--text-secondary);
}

/* 首屏左下角装饰标语：纯装饰，窄屏让位给内容 */
.hero-footnote {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: clamp(32px, 6vh, 56px);
}

.hero-footnote-dash {
  width: 24px;
  height: 1px;
  background: var(--accent);
}

.hero-footnote-text {
  padding: 6px 12px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  color: var(--text-secondary);
  /* 标语超出文字侧遮罩覆盖范围，自带玻璃底板保证两种主题下可读 */
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  backdrop-filter: blur(12px) saturate(1.1);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hero-footnote-text {
    background: var(--surface-bg);
  }
}

/* 入场动效以小位移淡入为起点；减少动态效果时由全局规则直接呈现终态 */
@media (prefers-reduced-motion: no-preference) {
  .hero-eyebrow,
  .hero-name,
  .hero-headline,
  .hero-intro,
  .hero-social {
    animation: hero-rise 550ms ease backwards;
  }

  .hero-name {
    animation-delay: 80ms;
  }

  .hero-headline {
    animation-delay: 160ms;
  }

  .hero-intro {
    animation-delay: 240ms;
  }

  .hero-social {
    animation-delay: 320ms;
  }
}

@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

/* 向下浏览入口：仅窄屏（内容超出首屏）出现，桌面首屏完整不设入口 */
.hero-scroll {
  display: none;
}

.hero-scroll-icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 1023px) {
  .hero-inner {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 28px;
    align-content: center;
    padding-block: calc(var(--header-height) + 40px) 48px;
  }

  /* 窄屏不再全域增白：整幅遮罩退场让风景主体保持层次，文字改由局部柔和底托住 */
  .hero-veil {
    background: none;
  }

  /* 文字组局部底：全宽条带（水平顶满容器、边缘落在视口边缘无接缝），
     纵向两端随 --hero-text-veil 渐隐至透明；
     z-index:0 使 .hero-text 成为层叠上下文，::before 垫在文字之下、壁纸之上 */
  .hero-text {
    position: relative;
    z-index: 0;
  }

  .hero-text::before {
    content: '';
    position: absolute;
    top: -48px;
    bottom: -56px;
    left: calc(-1 * var(--container-pad));
    right: calc(-1 * var(--container-pad));
    z-index: -1;
    background: var(--hero-text-veil);
  }

  /* 首屏名称 40–48px 起点；overflow-wrap 已允许长名称换行 */
  .hero-name {
    font-size: clamp(2.5rem, 11vw, 3rem);
  }

  .hero-panel {
    justify-self: start;
    max-width: 440px;
    /* 紧凑日期面板：优先压缩空白，不设固定最大高度，长内容自然增高不裁切 */
    padding: 20px;
  }

  .hero-panel-greeting {
    line-height: 1.7;
  }

  .hero-panel-divider {
    margin-block: 14px;
  }

  /* 日期 32–36px：随视口在两档间收敛，不整体缩小其他文字 */
  .hero-panel-monthday {
    font-size: clamp(2rem, 8.5vw, 2.25rem);
  }

  .hero-scroll {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--text-secondary);
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(8px) saturate(1.1);
    backdrop-filter: blur(8px) saturate(1.1);
    transition: color 160ms ease;
  }

  .hero-scroll:hover {
    color: var(--accent);
  }

  .hero-footnote {
    display: none;
  }
}
</style>
