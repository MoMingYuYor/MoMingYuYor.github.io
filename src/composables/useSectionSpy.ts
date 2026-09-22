import { onMounted, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * 当前章节定位（scroll-spy）：随滚动指示 Header 导航中的当前章节。
 *
 * 选择规则（技术方案 5.3，不用"最大面积比例"，避免长章节失选）：
 * 1. 页面滚动到底部：选 sectionIds 中最后一个章节——页尾短章节的顶部可能
 *    永远越不过遮挡线，靠该兜底保证"页尾选最后可见章节"；
 * 2. 其余情况：按 DOM 顺序取最后一个顶部越过 Header 遮挡线
 *   （getBoundingClientRect().top <= headerOffset）的章节。大章节覆盖整屏时
 *    其后继章节尚未越过遮挡线，因此保持选中；下一章节一旦越线即接管；
 * 3. 没有任何章节越过遮挡线：保持首个章节（首屏场景的默认值）。
 *
 * headerOffset 语义：Header 遮挡线距视口顶部的距离。App 传入 88px =
 * --header-height(64px) + 24px，与 global.css 中 section[id] 的
 * scroll-margin-top 一致——锚点直跳后章节顶部恰好落在遮挡线上，立即命中当前项。
 *
 * 重估时机：
 * - IntersectionObserver 观察条带（rootMargin 上边界 = 遮挡线、下边界收 55%
 *   视口），交叉状态变化时重估；观察目标仅为当前可见章节，
 *   sectionIds 变化时同步 observe/unobserve（内容为空移除章节即移除目标）；
 * - window scroll / resize（rAF 合帧）：覆盖"滚动到底"这类无交叉变化的场景；
 * - hashchange / popstate（初次 hash 直跳与浏览器前进后退）：滚动落定后
 *   nextTick 手动评估一次，保证立即正确。
 *
 * 展示契约：只更新 activeSectionId，不修改 hash、不调用 pushState、不移动焦点。
 */
export function useSectionSpy(
  sectionIds: Ref<string[]>,
  headerOffset: Ref<number>,
): { activeSectionId: Ref<string> } {
  const activeSectionId = ref('')

  /* 越线判断容差：浏览器滚动位按设备像素取整，锚点落点可能比遮挡线多出零点几像素
     （实测 88.14 > 88），不带容差会把"恰好落在遮挡线上"的当前章节误判为未越线 */
  const LINE_EPSILON = 1

  let observer: IntersectionObserver | null = null
  /* 已 observe 的目标表：sectionIds 变化时按 id 精确增删，避免重复 observe */
  const observed = new Map<string, Element>()

  /** 按选择规则重估当前章节；幂等，可被任意触发源调用 */
  function evaluate() {
    const ids = sectionIds.value
    if (ids.length === 0) {
      activeSectionId.value = ''
      return
    }
    const doc = document.documentElement
    /* 页尾兜底：滚动到底（留 1px 容差吸收小数滚动位）选最后可见章节 */
    const bottomGap = doc.scrollHeight - window.innerHeight - window.scrollY
    if (bottomGap <= 1) {
      activeSectionId.value = ids[ids.length - 1]
      return
    }
    const line = headerOffset.value + LINE_EPSILON
    let current = ids[0]
    /* 章节按 DOM 顺序给出（top 递增），取最后一个越过遮挡线的；越线前可提前停止 */
    for (const id of ids) {
      const el = document.getElementById(id)
      if (!el) continue
      if (el.getBoundingClientRect().top > line) break
      current = id
    }
    activeSectionId.value = current
  }

  /** 同步观察目标与 sectionIds：新增章节 observe，被移除章节 unobserve */
  function observeAll() {
    if (!observer) return
    const wanted = new Set(sectionIds.value)
    for (const id of wanted) {
      if (observed.has(id)) continue
      const el = document.getElementById(id)
      if (!el) continue
      observer.observe(el)
      observed.set(id, el)
    }
    for (const [id, el] of observed) {
      if (wanted.has(id)) continue
      observer.unobserve(el)
      observed.delete(id)
    }
  }

  function start() {
    /* 缺少 IntersectionObserver 的环境（测试/旧内核）降级为仅 scroll 驱动 */
    if (typeof IntersectionObserver !== 'function') return
    observer = new IntersectionObserver(
      () => evaluate(),
      /* 上部条带：上边界 = Header 遮挡线，下边界收 55% 视口；条带内进出即触发重估 */
      { rootMargin: `-${headerOffset.value}px 0px -55% 0px` },
    )
    observeAll()
  }

  function stop() {
    observer?.disconnect()
    observer = null
    observed.clear()
  }

  /* rAF 合帧的 scroll/resize 监听，避免高频滚动下重复读布局 */
  let frame = 0
  function scheduleEvaluate() {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      evaluate()
    })
  }

  /* hash 直跳与前进后退：锚点滚动完成后（下一帧）重估一次，保证立即正确 */
  function onHashNavigation() {
    window.requestAnimationFrame(evaluate)
  }

  onMounted(() => {
    start()
    evaluate()
    window.addEventListener('scroll', scheduleEvaluate, { passive: true })
    window.addEventListener('resize', scheduleEvaluate, { passive: true })
    window.addEventListener('hashchange', onHashNavigation)
    window.addEventListener('popstate', onHashNavigation)
  })

  onScopeDispose(() => {
    stop()
    if (frame) window.cancelAnimationFrame(frame)
    window.removeEventListener('scroll', scheduleEvaluate)
    window.removeEventListener('resize', scheduleEvaluate)
    window.removeEventListener('hashchange', onHashNavigation)
    window.removeEventListener('popstate', onHashNavigation)
  })

  /* 章节因内容为空被移除/新增时同步观察目标并重估（App 级实际内容稳定，契约兜底） */
  watch(sectionIds, () => {
    observeAll()
    evaluate()
  })

  /* 遮挡线变化时按新阈值重建观察器（当前 Header 高度固定，契约兜底） */
  watch(headerOffset, () => {
    stop()
    start()
    evaluate()
  })

  return { activeSectionId }
}
