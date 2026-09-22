<script setup lang="ts">
import { ref } from 'vue'
import { site } from '../content/site'
import GallerySection from './GallerySection.vue'

defineProps<{ number: string }>()

function isExternal(href: string) {
  return href.startsWith('https://')
}

/**
 * 本次会话的详情展开状态：按项目 id 记忆，仅保存在内存中（刷新页面即重置）。
 * 主题切换只改根元素 data-theme 属性、不重建本组件；切换项目只对非激活面板做
 * v-show 隐藏、details 元素保留——两种切换都不会清空该集合，展开状态不被错误重置。
 */
const expandedIds = ref<ReadonlySet<string>>(new Set())

/**
 * 原生 toggle 事件同步到会话状态：仅在与已记录状态不一致时写入，
 * 避免 :open 绑定的程序化回写再次触发 toggle 形成回环。
 */
function onDetailsToggle(id: string, event: Event) {
  const open = (event.target as HTMLDetailsElement).open
  if (open === expandedIds.value.has(id)) return
  const next = new Set(expandedIds.value)
  if (open) next.add(id)
  else next.delete(id)
  expandedIds.value = next
}
</script>

<template>
  <GallerySection
    section-id="projects"
    :number="number"
    :heading="site.galleries.projects.heading"
    :intro="site.galleries.projects.intro"
    :aside="site.galleries.projects.aside"
    :items="site.projects"
    variant="project"
  >
    <template #details="{ item }">
      <!-- 成果摘要默认可见（5.2）：缺失时整行隐藏，不渲染空事实 -->
      <p v-if="item.outcome" class="project-outcome">{{ item.outcome }}</p>

      <!-- 原生 details/summary：Enter/Space 展开由浏览器原生处理，summary 内不嵌套按钮；
           :open 绑定让组件重挂载时也能恢复会话状态 -->
      <details
        class="project-details"
        :open="expandedIds.has(item.id)"
        @toggle="onDetailsToggle(item.id, $event)"
      >
        <summary>项目详情</summary>
        <dl v-if="item.role || item.period || item.background" class="project-facts">
          <div v-if="item.role" class="project-fact">
            <dt>角色</dt>
            <dd>{{ item.role }}</dd>
          </div>
          <div v-if="item.period" class="project-fact">
            <dt>时间</dt>
            <dd>{{ item.period }}</dd>
          </div>
          <div v-if="item.background" class="project-fact">
            <dt>背景</dt>
            <dd>{{ item.background }}</dd>
          </div>
        </dl>
      </details>

      <!-- 访问与源码链接保持独立、可直接操作，不藏在必须展开的说明之后；缺省不渲染假地址 -->
      <div v-if="item.publishedUrl || item.sourceUrl" class="project-links">
        <a
          v-if="item.publishedUrl"
          :href="item.publishedUrl"
          :target="isExternal(item.publishedUrl) ? '_blank' : undefined"
          :rel="isExternal(item.publishedUrl) ? 'noopener noreferrer' : undefined"
        >访问项目</a>
        <a
          v-if="item.sourceUrl"
          :href="item.sourceUrl"
          :target="isExternal(item.sourceUrl) ? '_blank' : undefined"
          :rel="isExternal(item.sourceUrl) ? 'noopener noreferrer' : undefined"
        >查看源码</a>
      </div>
    </template>
  </GallerySection>
</template>

<style scoped>
/* 成果摘要：左侧细强调线的引用式排版，与页面细线语言一致；不设固定高度 */
.project-outcome {
  margin: 16px 0 0;
  padding-left: 12px;
  border-left: 2px solid var(--accent);
}

.project-details {
  margin-top: 4px;
}

/* 独立详情入口：摘要行保持可点触面积，箭头方向表达展开状态 */
.project-details summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 160ms ease;
  list-style: none;
}

.project-details summary::-webkit-details-marker {
  display: none;
}

.project-details summary::before {
  content: '→';
  flex: 0 0 auto;
  transition: transform 160ms ease;
}

.project-details[open] summary::before {
  transform: rotate(90deg);
}

.project-details summary:hover,
.project-details summary:focus-visible {
  color: var(--accent);
}

.project-facts {
  display: grid;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0;
}

.project-fact {
  display: grid;
  grid-template-columns: 3.5em minmax(0, 1fr);
  gap: 12px;
}

.project-fact dt {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.project-fact dd {
  margin: 0;
  font-size: 0.9375rem;
  overflow-wrap: anywhere;
}

.project-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 8px;
}

.project-links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 4px 2px;
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
</style>
