<script setup lang="ts">
import { ref } from 'vue'
import { site } from '../content/site'
import { assetUrl } from '../lib/assets'

defineProps<{ number: string }>()

const aboutPhotoFailed = ref(false)
const audioFailed = ref(false)

function onPhotoError() {
  aboutPhotoFailed.value = true
  console.warn('关于照片加载失败，已显示替代说明区域')
}

function isExternal(href: string) {
  return href.startsWith('https://')
}
</script>

<template>
  <section id="about" class="about-section section-block" aria-labelledby="about-heading">
    <div class="container">
      <header class="section-head">
        <div class="section-head-row">
          <span class="section-kicker-dash" aria-hidden="true"></span>
          <p class="section-number" aria-hidden="true">{{ number }}</p>
          <span class="section-kicker-sep" aria-hidden="true">/</span>
          <h2 id="about-heading" tabindex="-1" class="section-heading">{{ site.about.heading }}</h2>
        </div>
      </header>

      <div class="about-body">
        <div class="about-text">
          <p v-for="(paragraph, index) in site.about.paragraphs" :key="index" class="about-paragraph">
            {{ paragraph }}
          </p>

          <!-- 联系资料缺失时隐藏对应入口，不以空链接填补版面 -->
          <ul v-if="site.contacts.length" class="about-contacts" aria-label="联系方式">
            <li v-for="contact in site.contacts" :key="contact.href">
              <a
                :href="contact.href"
                :target="isExternal(contact.href) ? '_blank' : undefined"
                :rel="isExternal(contact.href) ? 'noopener noreferrer' : undefined"
              >{{ contact.label }}</a>
            </li>
          </ul>

          <!-- 音频缺省时入口完全隐藏；提供后仅在用户主动操作时播放 -->
          <div v-if="site.audio" class="about-audio">
            <p class="about-audio-title">{{ site.audio.title }}</p>
            <audio
              controls
              preload="none"
              :src="assetUrl(site.audio.src)"
              @error="audioFailed = true"
            ></audio>
            <p v-if="audioFailed" role="status" class="about-audio-error">
              音频暂时无法播放，请稍后重试。
            </p>
          </div>
        </div>

        <figure v-if="site.about.photo" class="about-photo">
          <img
            v-if="!aboutPhotoFailed"
            :src="assetUrl(site.about.photo.src)"
            :alt="site.about.photo.alt"
            :width="site.about.photo.width"
            :height="site.about.photo.height"
            loading="lazy"
            decoding="async"
            @error="onPhotoError"
          />
          <p v-else class="about-photo-fallback">{{ site.about.photo.alt }}</p>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-body {
  display: grid;
  gap: 32px;
}

.about-paragraph {
  max-width: 42em;
}

.about-paragraph + .about-paragraph {
  margin-top: 12px;
}

.about-contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.about-contacts a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 4px 2px;
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--accent);
}

.about-audio {
  margin-top: 24px;
  max-width: 32em;
}

.about-audio-title {
  margin-bottom: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
}

.about-audio audio {
  width: 100%;
}

.about-audio-error {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.about-photo {
  margin: 0;
  max-width: 360px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface-bg);
}

.about-photo img {
  display: block;
  width: 100%;
  height: auto;
}

/* 照片失败时保留有边界的替代说明区域，不出现破损图标 */
.about-photo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  margin: 0;
  padding: 16px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: center;
}

@media (min-width: 1024px) {
  .about-body {
    grid-template-columns: minmax(0, 1fr) 360px;
    align-items: start;
  }
}
</style>
