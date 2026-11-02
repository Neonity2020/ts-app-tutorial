import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react';

const chapters = [
  {
    href: '/docs/getting-started',
    label: '上篇 · 架构与起航',
    desc: 'Electron 进程模型、electron-vite 脚手架，跑通第一个窗口',
  },
  {
    href: '/docs/data-and-ui',
    label: '中篇 · 数据与界面',
    desc: 'shadcn/ui + better-sqlite3 + IPC，实现笔记增删改查与自动保存',
  },
  {
    href: '/docs/packaging',
    label: '下篇 · 打包与分发',
    desc: 'electron-builder 产出 Windows 安装包与 macOS dmg，踩坑全复盘',
  },
];

const stack = ['Electron 44', 'electron-vite 6', 'React 19', 'TypeScript', 'Tailwind v4', 'shadcn/ui', 'better-sqlite3'];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-24 text-center">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-fd-muted-foreground">
        <BookOpen className="size-4" />
        TypeScript 全栈实录系列
      </p>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        从零做一个
        <br />
        桌面记事本
      </h1>
      <p className="mt-6 max-w-xl text-lg text-fd-muted-foreground">
        用一门 TypeScript 贯通「界面 + 数据库 + 打包分发」。
        亲踩国内网络、原生模块、组件库接入的全部坑，附完整可运行源码。
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:opacity-90"
        >
          开始阅读
          <ArrowRight className="size-4" />
        </Link>
        <a
          href="https://github.com/Neonity2020/ts-app-tutorial"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-medium transition-colors hover:bg-fd-muted"
        >
          <ArrowUpRight className="size-4" />
          GitHub 仓库
        </a>
      </div>

      <div className="mt-20 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
        {chapters.map((chapter) => (
          <Link
            key={chapter.href}
            href={chapter.href}
            className="group rounded-2xl border p-5 transition-colors hover:bg-fd-muted"
          >
            <p className="font-semibold">{chapter.label}</p>
            <p className="mt-2 text-sm text-fd-muted-foreground">{chapter.desc}</p>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fd-muted-foreground transition-colors group-hover:text-fd-foreground">
              阅读
              <ArrowRight className="size-3.5" />
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-center gap-2">
        {stack.map((item) => (
          <span key={item} className="rounded-full bg-fd-muted px-3 py-1 text-xs text-fd-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </main>
  );
}
