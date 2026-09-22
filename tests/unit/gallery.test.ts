// 画廊状态纯逻辑单测：对应 src/lib/gallery.ts 的导出契约
import { describe, expect, it } from 'vitest'
import {
  normalizeActiveId,
  selectAfterRemoval,
  stepIndex,
  tabStepFromKey,
  withFailedUrl,
} from '../../src/lib/gallery'

describe('normalizeActiveId', () => {
  it('空数组时返回 null', () => {
    expect(normalizeActiveId([], 'any-id')).toBeNull()
    expect(normalizeActiveId([], null)).toBeNull()
  })

  it('activeId 仍存在于列表时原样返回', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(normalizeActiveId(items, 'b')).toBe('b')
  })

  it('activeId 已不存在时回退到第一项 id', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(normalizeActiveId(items, 'removed')).toBe('a')
  })

  it('activeId 为 null 时回退到第一项 id', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(normalizeActiveId(items, null)).toBe('a')
  })
})

describe('selectAfterRemoval', () => {
  it('删除中位项时选中原位置的下一项', () => {
    // 删除前为 [a, b, c]，删除下标 1 的 'b'，剩余 [a, c]；原位置的后一项是 'c'
    const remaining = [{ id: 'a' }, { id: 'c' }]
    expect(selectAfterRemoval(remaining, 1)).toBe('c')
  })

  it('删除首位项时选中原位置的下一项', () => {
    // 删除前为 [a, b, c]，删除下标 0 的 'a'，剩余 [b, c]；原位置的后一项是 'b'
    const remaining = [{ id: 'b' }, { id: 'c' }]
    expect(selectAfterRemoval(remaining, 0)).toBe('b')
  })

  it('删除末项时选中前一项', () => {
    // 删除前为 [a, b, c]，删除下标 2 的 'c'，剩余 [a, b]；末项已删，取前一项 'b'
    const remaining = [{ id: 'a' }, { id: 'b' }]
    expect(selectAfterRemoval(remaining, 2)).toBe('b')
  })

  it('删除唯一一项后返回 null', () => {
    // 删除前仅有一项 'a'，删除后剩余空数组，无项可选
    expect(selectAfterRemoval([], 0)).toBeNull()
  })

  it('空数组时返回 null', () => {
    expect(selectAfterRemoval([], 0)).toBeNull()
  })
})

describe('tabStepFromKey', () => {
  it("vertical 方向：ArrowDown/ArrowUp 映射为 next/prev，左右方向键无效", () => {
    expect(tabStepFromKey('ArrowDown', 'vertical')).toBe('next')
    expect(tabStepFromKey('ArrowUp', 'vertical')).toBe('prev')
    expect(tabStepFromKey('ArrowRight', 'vertical')).toBeNull()
    expect(tabStepFromKey('ArrowLeft', 'vertical')).toBeNull()
  })

  it("horizontal 方向：ArrowRight/ArrowLeft 映射为 next/prev，上下方向键无效", () => {
    expect(tabStepFromKey('ArrowRight', 'horizontal')).toBe('next')
    expect(tabStepFromKey('ArrowLeft', 'horizontal')).toBe('prev')
    expect(tabStepFromKey('ArrowDown', 'horizontal')).toBeNull()
    expect(tabStepFromKey('ArrowUp', 'horizontal')).toBeNull()
  })

  it('Home/End 在两种方向下一致映射为 first/last', () => {
    expect(tabStepFromKey('Home', 'vertical')).toBe('first')
    expect(tabStepFromKey('End', 'vertical')).toBe('last')
    expect(tabStepFromKey('Home', 'horizontal')).toBe('first')
    expect(tabStepFromKey('End', 'horizontal')).toBe('last')
  })

  it('其他键在两种方向下均返回 null', () => {
    expect(tabStepFromKey('Enter', 'vertical')).toBeNull()
    expect(tabStepFromKey('PageDown', 'vertical')).toBeNull()
    expect(tabStepFromKey(' ', 'horizontal')).toBeNull()
    expect(tabStepFromKey('', 'horizontal')).toBeNull()
  })
})

describe('stepIndex', () => {
  it('count 为 0 时一律返回 -1', () => {
    expect(stepIndex(0, 0, 'next')).toBe(-1)
    expect(stepIndex(0, 0, 'prev')).toBe(-1)
    expect(stepIndex(0, 0, 'first')).toBe(-1)
    expect(stepIndex(0, 0, 'last')).toBe(-1)
  })

  it("first 解析为首项 0，last 解析为末项 count-1", () => {
    expect(stepIndex(2, 3, 'first')).toBe(0)
    expect(stepIndex(0, 3, 'last')).toBe(2)
  })

  it('next 顺序前进，末项回绕到 0', () => {
    expect(stepIndex(0, 3, 'next')).toBe(1)
    expect(stepIndex(1, 3, 'next')).toBe(2)
    expect(stepIndex(2, 3, 'next')).toBe(0)
  })

  it('prev 顺序后退，首项回绕到末项', () => {
    expect(stepIndex(2, 3, 'prev')).toBe(1)
    expect(stepIndex(1, 3, 'prev')).toBe(0)
    expect(stepIndex(0, 3, 'prev')).toBe(2)
  })
})

describe('withFailedUrl', () => {
  it('新 URL 记入返回的新集合，原集合不变', () => {
    const before = new Set(['a.jpg'])
    const after = withFailedUrl(before, 'b.jpg')
    expect(after.has('b.jpg')).toBe(true)
    expect(after.has('a.jpg')).toBe(true)
    expect(before.has('b.jpg')).toBe(false)
  })

  it('重复 URL 不产生重复记录', () => {
    const once = withFailedUrl(new Set<string>(), 'a.jpg')
    const twice = withFailedUrl(once, 'a.jpg')
    expect(twice.size).toBe(1)
  })

  it('空集合首次记录后包含该 URL', () => {
    const after = withFailedUrl(new Set<string>(), 'a.jpg')
    expect([...after]).toEqual(['a.jpg'])
  })
})
