<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { site } from './content/site'
import { useSectionSpy } from './composables/useSectionSpy'
import AboutSection from './components/AboutSection.vue'
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import Hero from './components/Hero.vue'
import InterestGallery from './components/InterestGallery.vue'
import ProjectGallery from './components/ProjectGallery.vue'

interface NavSection {
  id: string
  label: string
  number?: string
}

const hasInterests = site.interests.length > 0
const hasProjects = site.projects.length > 0

/* 可见章节决定导航项，章节编号依据实际可见章节连续生成 */
const numberedSections = computed<NavSection[]>(() => {
  const sections: NavSection[] = []
  if (hasInterests) sections.push({ id: 'interests', label: site.galleries.interests.heading })
  if (hasProjects) sections.push({ id: 'projects', label: site.galleries.projects.heading })
  sections.push({ id: 'about', label: site.about.heading })
  return sections.map((section, index) => ({
    ...section,
    number: String(index + 1).padStart(2, '0'),
  }))
})

const navSections = computed<NavSection[]>(() => [{ id: 'home', label: '首页' }, ...numberedSections.value])

/* 当前章节定位：遮挡线 88px = --header-height(64px) + 24px，与 scroll-margin-top 一致，
   锚点直跳后章节顶部恰好落在遮挡线上、立即命中当前项 */
const headerOffset = ref(88)
const { activeSectionId } = useSectionSpy(
  computed(() => navSections.value.map((section) => section.id)),
  headerOffset,
)

function numberFor(id: string): string {
  return numberedSections.value.find((section) => section.id === id)?.number ?? ''
}

/* 纯 SPA 首次挂载前锚点目标尚不存在：挂载后按 hash 定位一次，不写入历史 */
onMounted(() => {
  const raw = window.location.hash
  if (raw.length <= 1) return
  let targetId: string
  try {
    targetId = decodeURIComponent(raw.slice(1))
  } catch {
    // 非法百分号编码的 hash 不阻断挂载
    return
  }
  document.getElementById(targetId)?.scrollIntoView()
})
</script>

<template>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <Header :sections="navSections" :active-section-id="activeSectionId" />
  <main id="main" tabindex="-1">
    <Hero />
    <InterestGallery v-if="hasInterests" :number="numberFor('interests')" />
    <ProjectGallery v-if="hasProjects" :number="numberFor('projects')" />
    <AboutSection :number="numberFor('about')" />
  </main>
  <Footer />
</template>
