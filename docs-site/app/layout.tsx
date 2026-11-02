import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';

export const metadata: Metadata = {
  title: {
    default: 'MiniNote 教程 · TypeScript 全栈实录',
    template: '%s · MiniNote 教程',
  },
  description:
    '《TypeScript 全栈实录：从零做一个桌面记事本》—— Electron + Vite + React + shadcn/ui + better-sqlite3 实战教程',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
