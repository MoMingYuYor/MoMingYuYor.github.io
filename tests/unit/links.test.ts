import { describe, expect, it } from 'vitest'

import { classifyHref, externalLinkAttributes, isExternalHref, isSafeHref } from '../../src/lib/links'

describe('classifyHref 拒绝用例', () => {
  it('拒绝凭据与反斜杠绕过形式', () => {
    expect(classifyHref('https://good.example\\@evil.example')).toBe('invalid')
    expect(classifyHref('https://user:pass@host')).toBe('invalid')
    expect(classifyHref('/\\evil.example')).toBe('invalid')
  })

  it('拒绝非 https 协议与协议相对地址', () => {
    expect(classifyHref('javascript:alert(1)')).toBe('invalid')
    expect(classifyHref('http://example.com')).toBe('invalid')
    expect(classifyHref('data:text/html,<script/>')).toBe('invalid')
    expect(classifyHref('//evil.example')).toBe('invalid')
  })

  it('拒绝无主机的 https 与空地址', () => {
    expect(classifyHref('https://')).toBe('invalid')
    expect(classifyHref('')).toBe('invalid')
    expect(classifyHref('mailto:')).toBe('invalid')
    expect(classifyHref('mailto:not-an-address')).toBe('invalid')
  })

  it('拒绝控制字符', () => {
    expect(classifyHref('/about/\u0000')).toBe('invalid')
    expect(classifyHref('https://example.com/\u001f')).toBe('invalid')
  })

  it('拒绝越界的站内路径', () => {
    expect(classifyHref('/../etc/passwd')).toBe('invalid')
    expect(classifyHref('/%2e%2e/etc')).toBe('invalid')
  })
})

describe('classifyHref 通过用例', () => {
  it('识别站内路径与锚点', () => {
    expect(classifyHref('/projects/ai-desk-companion/')).toBe('internal')
    expect(classifyHref('/projects/ai-desk-companion/#gallery')).toBe('internal')
    expect(classifyHref('#main')).toBe('internal')
    expect(classifyHref('/')).toBe('internal')
  })

  it('识别合法外链与邮件地址', () => {
    expect(classifyHref('https://github.com/MoMingYuYor')).toBe('external')
    expect(classifyHref('mailto:MoMingYu0610@gmail.com')).toBe('mailto')
  })

  it('片段不参与来源判定，也不使站内地址失效', () => {
    expect(classifyHref('/about/#contact')).toBe('internal')
    expect(classifyHref('https://example.com/a?b=c#d')).toBe('external')
  })
})

describe('便捷判断', () => {
  it('isSafeHref 与 classifyHref 一致', () => {
    expect(isSafeHref('/about/')).toBe(true)
    expect(isSafeHref('javascript:void(0)')).toBe(false)
  })

  it('只有真外链才需要新窗口属性', () => {
    expect(isExternalHref('https://github.com/MoMingYuYor')).toBe(true)
    expect(externalLinkAttributes('https://github.com/MoMingYuYor')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(externalLinkAttributes('mailto:a@b.co')).toBeUndefined()
    expect(externalLinkAttributes('/about/')).toBeUndefined()
  })
})
