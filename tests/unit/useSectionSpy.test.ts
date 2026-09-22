// @vitest-environment happy-dom
// useSectionSpy 契约单测：选择规则（越线最后章节/大章节保持/页尾/首屏默认）、
// sectionIds 变化同步观察目标（缺章节）、遮挡线 rootMargin、卸载清理与
// 无 IntersectionObserver 环境降级。重估用 window scroll / hashchange 事件驱动。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useSectionSpy } from '../../src/composables/useSectionSpy'

/* ---------- Fake IntersectionObserver：记录 rootMargin、观察目标与断开状态 ---------- */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  readonly rootMargin: string
  observed: Element[] = []
  disconnected = false
  constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = String(options?.rootMargin ?? '')
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element) {
    if (!this.observed.includes(el)) this.observed.push(el)
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((item) => item !== el)
  }
  disconnect() {
    this.disconnected = true
    this.observed = []
  }
}

/* ---------- 几何 stub：可还原的数值属性覆盖 ---------- */
const patched: Array<{ obj: object; key: string; desc: PropertyDescriptor | undefined }> = []
function stubNumber(obj: object, key: string, value: number) {
  patched.push({ obj, key, desc: Object.getOwnPropertyDescriptor(obj, key) })
  Object.defineProperty(obj, key, { configurable: true, value, writable: true })
}

/** 章节元素：getBoundingClientRect 返回可变的 top（模拟滚动位置变化） */
function createSection(id: string, top: number) {
  const rect = { top }
  const el = document.createElement('div')
  el.id = id
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({ top: rect.top, left: 0, right: 100, bottom: rect.top + 1000, width: 100, height: 1000 }) as unknown as DOMRect,
  })
  document.body.appendChild(el)
  return { el, setTop(next: number) { rect.top = next } }
}

/** 触发滚动事件并等待 rAF 合帧后的重估落盘 */
async function flushScroll() {
  window.dispatchEvent(new Event('scroll'))
  await new Promise((resolve) => setTimeout(resolve, 30))
}

/** 挂载宿主组件：activeSectionId 渲染为 data-active 便于断言（等待挂载后的首次重估渲染） */
async function mountSpy(ids: Ref<string[]>, offset: Ref<number>) {
  const Host = defineComponent({
    setup() {
      const { activeSectionId } = useSectionSpy(ids, offset)
      return () => h('div', { 'data-active': activeSectionId.value })
    },
  })
  const wrapper = mount(Host)
  await nextTick()
  return wrapper
}

function activeOf(wrapper: VueWrapper) {
  return wrapper.find('div').attributes('data-active')
}

afterEach(() => {
  while (patched.length) {
    const { obj, key, desc } = patched.pop()!
    if (desc) Object.defineProperty(obj, key, desc)
    else delete (obj as Record<string, unknown>)[key]
  }
  document.body.innerHTML = ''
  FakeIntersectionObserver.instances = []
  vi.unstubAllGlobals()
})

describe('useSectionSpy 选择规则', () => {
  it('初始为首个章节，越过遮挡线后取最后越线的章节', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    const home = createSection('home', -500)
    const interests = createSection('interests', 200)
    createSection('projects', 1200)
    createSection('about', 2400)

    const wrapper = await mountSpy(ref(['home', 'interests', 'projects', 'about']), ref(88))
    expect(activeOf(wrapper)).toBe('home')

    interests.setTop(-100) // 兴趣顶部越过遮挡线（-100 <= 88）
    await flushScroll()
    expect(activeOf(wrapper)).toBe('interests')
    wrapper.unmount()
  })

  it('大章节保持选中：后继章节越线前不切换', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', -2000) // 大章节深越线
    const interests = createSection('interests', 300) // 尚未越线
    createSection('projects', 1400)
    createSection('about', 2600)

    const wrapper = await mountSpy(ref(['home', 'interests', 'projects', 'about']), ref(88))
    expect(activeOf(wrapper)).toBe('home')

    interests.setTop(88) // 恰好落在遮挡线上（<=88 即越线）
    await flushScroll()
    expect(activeOf(wrapper)).toBe('interests')
    wrapper.unmount()
  })

  it('页面滚到底时选最后一个章节（页尾兜底）', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 3280) // 4000 - 720：滚动到底
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', -3000)
    createSection('interests', -1800)
    createSection('projects', -600)
    createSection('about', 100) // 页尾短章节顶部未越线

    const wrapper = await mountSpy(ref(['home', 'interests', 'projects', 'about']), ref(88))
    expect(activeOf(wrapper)).toBe('about')
    wrapper.unmount()
  })

  it('全部章节未越线时保持首个章节', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', 200)
    createSection('interests', 900)

    const wrapper = await mountSpy(ref(['home', 'interests']), ref(88))
    expect(activeOf(wrapper)).toBe('home')
    wrapper.unmount()
  })

  it('hashchange 后按落定的滚动位置重估（hash 直跳立即正确）', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', -1000) // 直跳前视口停在兴趣章节内（top 递增前提）
    createSection('interests', -600)
    const projects = createSection('projects', 1400) // 未越线
    createSection('about', 2100)

    const wrapper = await mountSpy(ref(['home', 'interests', 'projects', 'about']), ref(88))
    expect(activeOf(wrapper)).toBe('interests')

    // 锚点直跳落定带子像素取整误差（实测 88.14），带 1px 容差仍应判为越线
    projects.setTop(88.14)
    window.dispatchEvent(new Event('hashchange'))
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(activeOf(wrapper)).toBe('projects')
    wrapper.unmount()
  })
})

describe('useSectionSpy 观察目标与清理', () => {
  it('rootMargin 用遮挡线构造上部条带', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', 0)

    const wrapper = await mountSpy(ref(['home']), ref(88))
    expect(FakeIntersectionObserver.instances.at(-1)!.rootMargin).toBe('-88px 0px -55% 0px')
    wrapper.unmount()
  })

  it('sectionIds 变化同步 observe/unobserve（缺少兴趣章节）', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', -100)
    createSection('interests', 800)
    createSection('about', 1600)

    const ids = ref(['home', 'interests', 'about'])
    const wrapper = await mountSpy(ids, ref(88))
    expect(FakeIntersectionObserver.instances.at(-1)!.observed.map((el) => el.id)).toEqual([
      'home',
      'interests',
      'about',
    ])

    // 兴趣章节因内容为空移除：观察目标同步减少
    ids.value = ['home', 'about']
    await nextTick()
    expect(FakeIntersectionObserver.instances.at(-1)!.observed.map((el) => el.id)).toEqual([
      'home',
      'about',
    ])
    wrapper.unmount()
  })

  it('遮挡线变化时按新阈值重建观察器', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', 0)

    const offset = ref(88)
    const wrapper = await mountSpy(ref(['home']), offset)
    expect(FakeIntersectionObserver.instances).toHaveLength(1)
    offset.value = 120
    await nextTick()
    expect(FakeIntersectionObserver.instances).toHaveLength(2)
    expect(FakeIntersectionObserver.instances.at(-1)!.rootMargin).toBe('-120px 0px -55% 0px')
    wrapper.unmount()
  })

  it('卸载时断开观察器', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    createSection('home', 0)

    const wrapper = await mountSpy(ref(['home']), ref(88))
    const instance = FakeIntersectionObserver.instances.at(-1)!
    expect(instance.disconnected).toBe(false)
    wrapper.unmount()
    expect(instance.disconnected).toBe(true)
  })

  it('无 IntersectionObserver 的环境降级为 scroll 驱动且可用', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)
    const home = createSection('home', 0)
    const interests = createSection('interests', 700)

    const wrapper = await mountSpy(ref(['home', 'interests']), ref(88))
    expect(activeOf(wrapper)).toBe('home')

    interests.setTop(-100)
    home.setTop(-700)
    await flushScroll()
    expect(activeOf(wrapper)).toBe('interests')
    wrapper.unmount()
  })

  it('sectionIds 为空时 activeSectionId 清空', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    stubNumber(window, 'innerHeight', 720)
    stubNumber(window, 'scrollY', 0)
    stubNumber(document.documentElement, 'scrollHeight', 4000)

    const wrapper = await mountSpy(ref([]), ref(88))
    expect(activeOf(wrapper)).toBe('')
    wrapper.unmount()
  })
})
