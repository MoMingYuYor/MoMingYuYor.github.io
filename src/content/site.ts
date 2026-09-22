import type { SiteContent } from '../types/content'

/**
 * 站点内容单一来源。
 * 当前全部为演示占位：姓名、图片、条目与链接均待用户提供后替换，
 * status 保持 'demo'，公开发布前须逐项核验并转为 'ready'。
 */
export const site: SiteContent = {
  status: 'demo',
  identity: {
    displayName: 'MoMingYu',
    eyebrow: 'PERSONAL SPACE',
    legalName: '邹健涛',
    headline: '把喜欢的事，慢慢做成生活。',
    introduction: '记录探索，分享作品，也留下一些日常。这里将展示个人自述，真实资料提供后替换本段演示文字。',
    avatar: {
      src: 'images/avatar.webp',
      alt: 'MoMingYu 的头像',
      width: 512,
      height: 512,
      kind: 'photo',
    },
  },
  seo: {
    title: 'MoMingYu · AI 全栈开发',
    description: 'MoMingYu 的个人主页：AI 全栈开发学习者，正在探索 agent 开发，同时是电脑 DIY 与硬件发烧友。',
    locale: 'zh-CN',
    allowIndex: false,
  },
  hero: {
    dark: {
      src: 'images/hero-dark.webp',
      desktopPosition: '50% 50%',
      mobilePosition: '60% 50%',
      alt: '',
      kind: 'photo',
      width: 1600,
      height: 900,
    },
    light: {
      src: 'images/hero-light.webp',
      desktopPosition: '50% 50%',
      mobilePosition: '60% 50%',
      alt: '',
      kind: 'photo',
      width: 1600,
      height: 900,
    },
    wish: '愿你在热爱的世界里，保持温柔与好奇。',
    quote: '山湖会记得，每一个认真生活的人。',
    footnote: 'SOME PLACES MAKE A KINDER YOU.',
  },
  galleries: {
    interests: {
      heading: '兴趣',
      intro: '工作之外着迷的事情；装机与硬件折腾的记录会陆续整理到这里。',
      aside: '把复杂的东西拆开、弄懂、再装回去。',
    },
    projects: {
      heading: '作品',
      intro: '正在做和做过的东西；技术说明与访问、源码链接随资料补全。',
      aside: '在不同的片段里，遇见更真实的自己。',
    },
  },
  interests: [
    {
      id: 'pc-diy',
      title: '电脑 DIY · 装机',
      summary: '装过的机器与配置思路，图片陆续补充中。',
      image: {
        src: 'images/placeholder-photo-1.svg',
        alt: '装机照片待补充：电脑 DIY 装机过程',
        width: 1600,
        height: 1000,
        kind: 'photo',
      },
    },
    {
      id: 'overclocking',
      title: '硬件发烧友 · 超频',
      summary: '超频实践与硬件调校，文章整理中。',
      image: {
        src: 'images/placeholder-photo-2.svg',
        alt: '超频文章配图待补充：硬件发烧友与超频实践',
        width: 1600,
        height: 1000,
        kind: 'photo',
      },
    },
  ],
  projects: [
    {
      id: 'ai-desk-companion',
      title: 'AI Desk Companion',
      summary: '以 AI 通知分析为入口，集成桌宠、工作台、日历与待办的个人事务管理工具。',
      role: '独立开发',
      period: '2026 年至今',
      background: '想要一个本地优先、数据不出本机的个人事务助手：把群通知、邮件与文档里的信息提炼成可确认的日程与待办，同时作为 AI 应用全栈开发的实践。',
      outcome: '完成 Electron 37 + React 19 + TypeScript + sql.js(SQLite) 的桌面端实现：通知分析、多邮箱聚合（只读 IMAP）、桌宠伴侣、确认制工作流与独立于模型的提醒调度引擎；419 个自动化用例通过，提供 Windows 便携版。',
      image: {
        src: 'images/placeholder-shot-1.svg',
        alt: 'AI Desk Companion 应用截图待补充',
        width: 1600,
        height: 1000,
        kind: 'screenshot',
      },
      sourceUrl: 'https://github.com/MoMingYuYor/ai-desk-companion',
    },
  ],
  about: {
    heading: '关于',
    paragraphs: [
      '这里将展示个人简介。真实资料提供后，替换本段演示文字。',
      '第二段用于演示多段排版：关注方向、正在做的事与希望交流的话题都会写在这里。',
    ],
    photo: {
      src: 'images/about.webp',
      alt: '演示占位图：午后窗边的阅读角落，摊开的书与一杯热茶',
      width: 1280,
      height: 720,
      kind: 'photo',
    },
  },
  /* 联系入口均为已核验地址；音乐播放入口待曲目确定后接入 */
  contacts: [
    { label: 'GitHub', href: 'https://github.com/MoMingYuYor', icon: 'github' },
    { label: '邮箱', href: 'mailto:MoMingYu0610@gmail.com', icon: 'mail' },
  ],
}
