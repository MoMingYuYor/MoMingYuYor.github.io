// @vitest-environment happy-dom
// T4 项目页内详情（方案 5.2）+ 兴趣不展示项目事实（方案 5.1）：
// 原生 details/summary 结构与默认折叠、toggle 状态同步、项目/主题切换不错误重置、
// 缺失字段隐藏对应事实行、链接保持独立。
// 说明：真实浏览器的 summary Enter/Space 激活与折叠内容不可见由 e2e（Chromium）验证——
// happy-dom 不实现 summary 键盘激活，也不对关闭的 details 施加 UA 隐藏。
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import InterestGallery from '../../src/components/InterestGallery.vue'
import ProjectGallery from '../../src/components/ProjectGallery.vue'
import type { SiteContent } from '../../src/types/content'

/* 受控站点替身（整体替换 site 模块）：p1 字段齐全带双链接；p2 成果与全部事实为空、无链接 */
const testSite = vi.hoisted(
  () =>
    ({
      status: 'demo',
      galleries: {
        interests: { heading: '兴趣', intro: '兴趣简介', aside: '兴趣引文' },
        projects: { heading: '作品', intro: '作品简介', aside: '作品引文' },
      },
      interests: [
        {
          id: 'i1',
          title: '演示兴趣',
          summary: '兴趣摘要',
          image: { src: 'images/i1.webp', alt: '兴趣图', width: 1280, height: 720, kind: 'photo' },
        },
      ],
      projects: [
        {
          id: 'p1',
          title: '演示项目一',
          summary: '项目一摘要',
          role: '角色 A',
          period: '2025 年',
          background: '背景说明。',
          outcome: '成果说明。',
          image: { src: 'images/p1.webp', alt: '项目一图', width: 1280, height: 720, kind: 'photo' },
          publishedUrl: 'https://example.com/p1',
          sourceUrl: 'https://example.com/p1-src',
        },
        {
          id: 'p2',
          title: '演示项目二',
          summary: '项目二摘要',
          role: '',
          period: '',
          background: '',
          outcome: '',
          image: { src: 'images/p2.webp', alt: '项目二图', width: 1280, height: 720, kind: 'photo' },
        },
      ],
    }) as SiteContent,
)

vi.mock('../../src/content/site', () => ({ site: testSite }))

/* GallerySection 依赖 matchMedia（桌面断点）与 scrollIntoView：与 gallery.spec 同一桩策略 */
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}
const originalScrollIntoView = Element.prototype.scrollIntoView
const originalMatchMedia = window.matchMedia

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

const wrappers: { unmount(): void }[] = []

function mountWrapper(component: typeof InterestGallery | typeof ProjectGallery) {
  stubMatchMedia(true)
  const wrapper = mount(component, { props: { number: '01' }, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

type GalleryWrapper = ReturnType<typeof mountWrapper>

/** 两个 nextTick：覆盖渲染刷新与组件内 nextTick 回调（如焦点移动） */
const flush = async () => {
  await nextTick()
  await nextTick()
}

/** 面板按条目顺序排列（全部渲染、仅显示激活项），面板内 details 的原生 open 状态 */
function detailsOf(wrapper: GalleryWrapper, index: number) {
  const panel = wrapper.findAll('.gallery-panel')[index]!
  return panel.find('details.project-details')
}

function detailsOpen(wrapper: GalleryWrapper, index: number) {
  return (detailsOf(wrapper, index).element as HTMLDetailsElement).open
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  document.documentElement.removeAttribute('data-theme')
  window.matchMedia = originalMatchMedia
  Element.prototype.scrollIntoView = originalScrollIntoView
  vi.restoreAllMocks()
})

describe('兴趣章节不展示项目事实（5.1）', () => {
  it('无成果摘要、详情展开区、事实列表与项目链接', () => {
    const wrapper = mountWrapper(InterestGallery)
    expect(wrapper.find('.project-outcome').exists()).toBe(false)
    expect(wrapper.find('.project-details').exists()).toBe(false)
    expect(wrapper.find('.project-facts').exists()).toBe(false)
    expect(wrapper.find('.project-links').exists()).toBe(false)
  })
})

describe('项目详情结构与默认状态（5.2）', () => {
  it('详情默认折叠：details 未展开，成果摘要与链接在展开区之外，事实行在展开区内', () => {
    const wrapper = mountWrapper(ProjectGallery)
    const details = detailsOf(wrapper, 0)
    expect(details.exists()).toBe(true)
    expect(detailsOpen(wrapper, 0)).toBe(false)
    expect(details.find('summary').text()).toBe('项目详情')

    // 成果摘要默认可见，不在 details 内部
    const outcome = wrapper.findAll('.gallery-panel')[0]!.find('.project-outcome')
    expect(outcome.exists()).toBe(true)
    expect(outcome.text()).toBe('成果说明。')
    expect(outcome.element.contains(details.element)).toBe(false)

    // 角色/时间/背景进入 details 内部
    const firstDt = wrapper.findAll('.gallery-panel')[0]!.find('.project-fact dt')
    expect(firstDt.exists()).toBe(true)
    expect(details.element.contains(firstDt.element)).toBe(true)

    // 访问/源码链接独立、可直接操作，不藏在展开区之后
    const links = wrapper.findAll('.gallery-panel')[0]!.findAll('.project-links a')
    expect(links.length).toBe(2)
    for (const link of links) {
      expect(link.element.closest('details')).toBeNull()
    }
    expect(links[0].attributes('href')).toBe('https://example.com/p1')
  })

  it('summary 无嵌套交互元素且是 details 首个子元素，details 内部无可聚焦元素', () => {
    const wrapper = mountWrapper(ProjectGallery)
    const details = detailsOf(wrapper, 0)
    const summary = details.find('summary')
    expect(summary.exists()).toBe(true)
    // summary 内嵌按钮/链接会破坏原生激活语义（方案 5.2：摘要不嵌套按钮）
    expect(summary.find('button, a, input, select, textarea').exists()).toBe(false)
    // summary 是 details 的第一个元素子元素：原生点击/键盘激活语义的前提
    expect(summary.element).toBe(details.element.firstElementChild)
    // details 内部只有事实文本，折叠时由原生语义整体退出渲染与 Tab 顺序
    const focusables = details.element.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
    expect(focusables.length).toBe(0)
  })

  it('缺失字段隐藏对应事实行：空成果不渲染摘要、空事实不渲染列表、无链接不渲染链接区', () => {
    const wrapper = mountWrapper(ProjectGallery)
    const sparsePanel = wrapper.findAll('.gallery-panel')[1]!
    expect(sparsePanel.find('.project-outcome').exists()).toBe(false)
    expect(sparsePanel.find('.project-facts').exists()).toBe(false)
    expect(sparsePanel.find('.project-links').exists()).toBe(false)

    // 完整项目的事实行：角色/时间/背景三行（成果已移出为独立摘要）
    const dts = wrapper
      .findAll('.gallery-panel')[0]!
      .findAll('.project-fact dt')
      .map((dt) => dt.text())
    expect(dts).toEqual(['角色', '时间', '背景'])
  })
})

describe('展开交互与会话状态', () => {
  it('点击 summary 展开/收起，open 属性与会话状态往返同步', async () => {
    const wrapper = mountWrapper(ProjectGallery)
    expect(detailsOpen(wrapper, 0)).toBe(false)

    await detailsOf(wrapper, 0).find('summary').trigger('click')
    await flush()
    expect(detailsOpen(wrapper, 0)).toBe(true)

    await detailsOf(wrapper, 0).find('summary').trigger('click')
    await flush()
    expect(detailsOpen(wrapper, 0)).toBe(false)
  })

  it('切换项目再切回，展开状态保持；收起后同样保持', async () => {
    const wrapper = mountWrapper(ProjectGallery)
    const tabs = wrapper.findAll('[role="tab"]')

    await detailsOf(wrapper, 0).find('summary').trigger('click')
    await tabs[1].trigger('click')
    await flush()
    await tabs[0].trigger('click')
    await flush()
    expect(detailsOpen(wrapper, 0)).toBe(true)

    await detailsOf(wrapper, 0).find('summary').trigger('click')
    await tabs[1].trigger('click')
    await flush()
    await tabs[0].trigger('click')
    await flush()
    expect(detailsOpen(wrapper, 0)).toBe(false)
  })

  it('主题切换（根元素 data-theme 属性变化）不重建 details、不重置展开状态', async () => {
    const wrapper = mountWrapper(ProjectGallery)
    await detailsOf(wrapper, 0).find('summary').trigger('click')
    await flush()
    expect(detailsOpen(wrapper, 0)).toBe(true)

    // 主题切换只改根元素 data-theme 属性、不触碰组件子树：details 元素应保持同一节点
    const detailsBefore = detailsOf(wrapper, 0).element
    document.documentElement.setAttribute('data-theme', 'dark')
    await flush()
    expect(detailsOf(wrapper, 0).element).toBe(detailsBefore)
    expect(detailsOpen(wrapper, 0)).toBe(true)
  })

  it('键盘切换项目后焦点保持在所选标签，目标详情保持折叠', async () => {
    const wrapper = mountWrapper(ProjectGallery)
    const tabs = wrapper.findAll('[role="tab"]')
    ;(tabs[0].element as HTMLElement).focus()
    await wrapper.find('[role="tablist"]').trigger('keydown', { key: 'ArrowDown' })
    await flush()
    // 焦点留在所选标签上，不强行跳入详情
    expect(document.activeElement?.id).toBe('projects-tab-p2')
    expect(detailsOpen(wrapper, 1)).toBe(false)
  })
})
