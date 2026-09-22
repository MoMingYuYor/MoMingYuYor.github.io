// @vitest-environment happy-dom
// GallerySection 组件测试：0/1/多项语义、按 URL 记录的图片失败状态、键盘契约与选中项滚动。
// 仅本文件使用 DOM 环境（文件级注解），tests/unit 纯函数测试仍跑在 Node。
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import GallerySection from '../../src/components/GallerySection.vue'
import type { GalleryItem } from '../../src/types/content'

/* happy-dom 可能未实现 scrollIntoView：先补 no-op，避免生产代码调用时报错 */
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}
const originalScrollIntoView = Element.prototype.scrollIntoView
const originalMatchMedia = window.matchMedia

/* 已挂载且需要从真实 document 卸载的 wrapper（键盘焦点与 getElementById 依赖文档） */
const wrappers: { unmount(): void }[] = []

/** 以固定结果替换 window.matchMedia；desktop=true 表示 (min-width: 1024px) 命中 */
function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function makeItem(id: string, src = `img/${id}.jpg`): GalleryItem {
  return {
    id,
    title: `条目${id}`,
    summary: `摘要${id}`,
    image: { kind: 'photo', src, alt: `图片${id}`, width: 1600, height: 1000 },
    publishedUrl: `https://example.com/${id}`,
  }
}

function mountGallery(
  items: GalleryItem[],
  options: { sectionId?: string; desktop?: boolean; variant?: 'interest' | 'project' } = {},
) {
  stubMatchMedia(options.desktop ?? true)
  const wrapper = mount(GallerySection, {
    props: {
      sectionId: options.sectionId ?? 'interests',
      number: '01',
      heading: '兴趣',
      intro: '章节简介',
      items,
      // T4 起 variant 为必填 prop；本文件既有用例均为兴趣形态，默认传 interest
      variant: options.variant ?? 'interest',
    },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

type GalleryWrapper = ReturnType<typeof mountGallery>

/** 当前可见（v-show 未隐藏）的面板元素包装 */
function activePanel(wrapper: GalleryWrapper) {
  const visible = wrapper
    .findAll('.gallery-panel')
    .find((panel) => (panel.element as HTMLElement).style.display !== 'none')
  expect(visible).toBeDefined()
  return visible!
}

/** 两个 nextTick：覆盖渲染刷新与组件内 nextTick 回调（如焦点移动） */
const flush = async () => {
  await nextTick()
  await nextTick()
}

beforeEach(() => {
  // markFailed 的 console.warn 不进入测试输出
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  window.matchMedia = originalMatchMedia
  Element.prototype.scrollIntoView = originalScrollIntoView
  vi.restoreAllMocks()
})

describe('0 项', () => {
  it('不渲染 tablist、tab、tabpanel 与任何图片', () => {
    const wrapper = mountGallery([])
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="tab"]').length).toBe(0)
    expect(wrapper.findAll('[role="tabpanel"]').length).toBe(0)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.media-fallback').exists()).toBe(false)
  })
})

describe('单项语义', () => {
  it('显示普通内容区：无 tablist、无 tab、无 tabpanel', () => {
    const wrapper = mountGallery([makeItem('a')])
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="tab"]').length).toBe(0)
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)
  })

  it('不留指向不存在标签的 aria-labelledby，标题与图片仍存在', () => {
    const wrapper = mountGallery([makeItem('a')])
    for (const el of wrapper.findAll('[aria-labelledby]')) {
      const refId = el.attributes('aria-labelledby') ?? ''
      expect(document.getElementById(refId)).not.toBeNull()
    }
    expect(wrapper.find('.gallery-title').text()).toBe('条目a')
    const img = wrapper.find('.gallery-frame img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBe('图片a')
  })
})

describe('多项 tabs 语义', () => {
  it('渲染 tablist 与全部面板，每个 aria-controls 指向真实面板，同时仅一个可见', () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b'), makeItem('c')])
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.length).toBe(3)
    for (const tab of tabs) {
      const controls = tab.attributes('aria-controls') ?? ''
      const panel = document.getElementById(controls)
      expect(panel).not.toBeNull()
      expect(panel?.getAttribute('role')).toBe('tabpanel')
      // T2 评审转来（T8 顺带补）：面板须以 aria-labelledby 回指当前标签 id
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.attributes('id'))
    }
    const visiblePanels = wrapper
      .findAll('[role="tabpanel"]')
      .filter((panel) => (panel.element as HTMLElement).style.display !== 'none')
    expect(visiblePanels.length).toBe(1)
  })

  it('图片与对应文字共同处于面板内容区域内', () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    const panel = activePanel(wrapper)
    expect(panel.find('.gallery-frame img').exists()).toBe(true)
    expect(panel.find('.gallery-title').text()).toBe('条目a')
    expect(panel.find('.gallery-summary').text()).toBe('摘要a')
  })

  it('桌面竖向：ArrowDown 移动选中标签并把焦点移到新标签', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b'), makeItem('c')])
    ;(wrapper.findAll('[role="tab"]')[0].element as HTMLElement).focus()
    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowDown' })
    await flush()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(document.activeElement?.id).toBe('interests-tab-b')
  })

  it('移动横向：ArrowRight 移动选中标签，ArrowDown 无效', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b'), makeItem('c')], { desktop: false })
    const tablist = wrapper.find('[role="tablist"]')
    await tablist.trigger('keydown', { key: 'ArrowRight' })
    await flush()
    let tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    await tablist.trigger('keydown', { key: 'ArrowDown' })
    await flush()
    tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[1].attributes('aria-selected')).toBe('true')
  })

  it('切换激活项后选中标签滚入选择器可见区域（nearest，不拉整页）', async () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const wrapper = mountGallery([makeItem('a'), makeItem('b'), makeItem('c')])
    await wrapper.findAll('[role="tab"]')[2].trigger('click')
    await flush()
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })
})

describe('图片失败状态（按 URL 记录）', () => {
  it('主图失败时显示固定占位与替代文本，激活面板内不再有 img', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    await activePanel(wrapper).find('.gallery-frame img').trigger('error')
    const panel = activePanel(wrapper)
    const fallback = panel.find('.media-fallback')
    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toBe('图片a')
    expect(panel.find('img').exists()).toBe(false)
  })

  it('主图与同 URL 缩略图共享失败状态', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    await activePanel(wrapper).find('.gallery-frame img').trigger('error')
    expect(wrapper.findAll('.gallery-tab-thumb-fallback').length).toBe(1)
    expect(wrapper.findAll('.gallery-tab-thumb').length).toBe(1)
  })

  it('缩略图失败时显示占位，主图同步共享失败状态', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    await wrapper.find('.gallery-tab-thumb').trigger('error')
    expect(wrapper.findAll('.gallery-tab-thumb-fallback').length).toBe(1)
    expect(activePanel(wrapper).find('.media-fallback').exists()).toBe(true)
  })

  it('切换到其他图片不继承失败标记，切回仍保留记录', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    await activePanel(wrapper).find('.gallery-frame img').trigger('error')
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(activePanel(wrapper).find('.media-fallback').exists()).toBe(false)
    expect(activePanel(wrapper).find('.gallery-frame img').exists()).toBe(true)
    await wrapper.findAll('[role="tab"]')[0].trigger('click')
    expect(activePanel(wrapper).find('.media-fallback').exists()).toBe(true)
  })

  it('同一条目更换 URL 后允许重新加载', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b')])
    await activePanel(wrapper).find('.gallery-frame img').trigger('error')
    expect(activePanel(wrapper).find('.media-fallback').exists()).toBe(true)
    await wrapper.setProps({ items: [makeItem('a', 'img/a2.jpg'), makeItem('b')] })
    const panel = activePanel(wrapper)
    expect(panel.find('.media-fallback').exists()).toBe(false)
    expect(panel.find('.gallery-frame img').attributes('src')).toContain('a2.jpg')
  })
})

describe('激活项回退与 id 前缀', () => {
  it('删除激活项后选中原位置的下一项', async () => {
    const wrapper = mountGallery([makeItem('a'), makeItem('b'), makeItem('c')])
    await wrapper.findAll('[role="tab"]')[1].trigger('click') // 激活 b
    await wrapper.setProps({ items: [makeItem('a'), makeItem('c')] })
    await flush()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.length).toBe(2)
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(activePanel(wrapper).find('.gallery-title').text()).toBe('条目c')
  })

  it('两个章节的同名条目因章节前缀不冲突', () => {
    mountGallery([makeItem('a')], { sectionId: 'interests', variant: 'interest' })
    mountGallery([makeItem('a')], { sectionId: 'projects', variant: 'project' })
    expect(document.querySelectorAll('#interests-panel-a')).toHaveLength(1)
    expect(document.querySelectorAll('#projects-panel-a')).toHaveLength(1)
    expect(document.getElementById('interests-panel-a')).not.toBeNull()
    expect(document.getElementById('projects-panel-a')).not.toBeNull()
  })
})
