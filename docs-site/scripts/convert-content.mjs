/**
 * 一次性内容迁移：把公众号文章 markdown 转为 fumadocs 文档页
 * - 去掉文章 H1（标题由 frontmatter 提供）
 * - 上篇去掉开头的系列目录 blockquote（侧边导航已承担该职责）
 * - 去掉文末「仓库地址」占位斜体行
 * - 中下篇保留开头回顾 blockquote 和结尾引导语
 */
import { readFileSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const articlesDir = join(here, '..', '..', 'articles')
const docsDir = join(here, '..', 'content', 'docs')

const posts = [
  {
    src: '01-上篇-Electron核心概念与第一个窗口.md',
    slug: 'getting-started.mdx',
    title: '上篇 · 架构与起航',
    description: 'Electron 进程模型、electron-vite 脚手架，跑通第一个窗口',
    stripLeadingQuote: true,
  },
  {
    src: '02-中篇-shadcn与SQLite实现笔记CRUD.md',
    slug: 'data-and-ui.mdx',
    title: '中篇 · 数据与界面',
    description: 'shadcn/ui + better-sqlite3 + IPC，实现笔记增删改查与自动保存',
    stripLeadingQuote: false,
  },
  {
    src: '03-下篇-electron-builder打包与踩坑复盘.md',
    slug: 'packaging.mdx',
    title: '下篇 · 打包与分发',
    description: 'electron-builder 产出 Windows 安装包与 macOS dmg，踩坑全复盘',
    stripLeadingQuote: false,
  },
]

for (const post of posts) {
  let text = readFileSync(join(articlesDir, post.src), 'utf8')

  const lines = text.split('\n')
  // 1. 去掉第一行 H1
  if (lines[0]?.startsWith('# ')) lines.shift()
  // 2. 上篇：去掉紧随其后的连续 blockquote（系列目录）
  if (post.stripLeadingQuote) {
    while (lines[0] !== undefined && (lines[0].startsWith('>') || lines[0].trim() === '')) {
      if (lines[0].trim() === '' && lines[1] !== undefined && !lines[1].startsWith('>')) break
      lines.shift()
    }
  }
  // 3. 去掉文末仓库地址占位行
  const cleaned = lines
    .join('\n')
    .replace(/\n\*[^*\n]*你的仓库地址[^*\n]*\*\s*$/g, '')
    .trimEnd()

  const frontmatter = `---\ntitle: ${post.title}\ndescription: ${post.description}\n---\n\n`
  writeFileSync(join(docsDir, post.slug), frontmatter + cleaned + '\n')
  console.log(`wrote ${post.slug} (${cleaned.length} chars)`)
}

// index.mdx 与 meta.json
const indexMdx = `---
title: 简介
description: 《TypeScript 全栈实录：从零做一个桌面记事本》—— 用一门 TypeScript 贯通界面、数据库与打包分发
---

本教程带你在 2026 年的技术栈上，从零构建一个真实可用的桌面记事本 **MiniNote**：左侧笔记列表、右侧沉浸式编辑器、停止输入自动保存进 SQLite，最终打包成双击安装的 \`.exe\`。

全程使用 **pnpm** 管理，Windows 主讲、macOS 差异随文标注，所有命令与代码都在真实环境验证过。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 构建框架 | electron-vite 6 + Vite 8 |
| 界面 | React 19 + Tailwind CSS v4 + shadcn/ui |
| 数据 | better-sqlite3 13（N-API 预编译，免重编译） |
| 语言 | TypeScript 5.9，类型链贯通三进程 |
| 打包 | electron-builder 26（NSIS / dmg） |

## 目录

<Cards>
  <Card title="上篇 · 架构与起航" description="Electron 进程模型、electron-vite 脚手架，跑通第一个窗口" href="/docs/getting-started" />
  <Card title="中篇 · 数据与界面" description="shadcn/ui + better-sqlite3 + IPC，实现笔记增删改查与自动保存" href="/docs/data-and-ui" />
  <Card title="下篇 · 打包与分发" description="electron-builder 产出 Windows 安装包与 macOS dmg，踩坑全复盘" href="/docs/packaging" />
</Cards>

## 源码

完整项目在本仓库根目录，clone 后两步跑起来：

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

仓库地址：[github.com/Neonity2020/ts-app-tutorial](https://github.com/Neonity2020/ts-app-tutorial)
`
writeFileSync(join(docsDir, 'index.mdx'), indexMdx)
// fumadocs v16：meta.json 必须是对象（pages 数组），裸数组会在构建期报 schema 错误
writeFileSync(
  join(docsDir, 'meta.json'),
  JSON.stringify(
    { title: 'MiniNote 教程', pages: ['index', 'getting-started', 'data-and-ui', 'packaging'] },
    null,
    2
  ) + '\n'
)

rmSync(join(docsDir, 'test.mdx'), { force: true })
console.log('index.mdx + meta.json written, test.mdx removed')
