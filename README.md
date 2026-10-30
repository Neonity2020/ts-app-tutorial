# MiniNote · 极简记事本

《TypeScript 全栈实录：从零做一个桌面记事本》系列文章的配套示例项目。

技术栈：**Electron + electron-vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + better-sqlite3**

## 📚 系列文章

完整教程在 [`articles/`](./articles/) 目录：

1. [上篇 · Electron 核心概念与第一个窗口](./articles/01-上篇-Electron核心概念与第一个窗口.md)
2. [中篇 · shadcn/ui + SQLite + IPC 实现笔记 CRUD](./articles/02-中篇-shadcn与SQLite实现笔记CRUD.md)
3. [下篇 · electron-builder 打包 Windows/Mac 与踩坑复盘](./articles/03-下篇-electron-builder打包与踩坑复盘.md)

## 功能

- 左侧笔记列表（按最近修改排序），右侧无边框编辑器
- 新建 / 编辑 / 删除笔记（删除有二次确认）
- 停止输入 600ms 后自动保存进 SQLite（防抖 + 切换时冲刷）
- 数据持久化在系统用户数据目录：
  - Windows：`%AppData%\MiniNote\mininote.db`
  - macOS：`~/Library/Application Support/MiniNote/mininote.db`

## 快速开始

要求：Node.js ≥ 22（或 20.19+）、pnpm ≥ 9

```bash
pnpm install        # 已配置国内镜像，Electron 二进制下载失败可看 .npmrc
pnpm dev            # 开发模式（支持热更新，F12 打开 DevTools）
```

## 常用脚本

```bash
pnpm typecheck      # 双 tsconfig 类型检查（node 侧 + web 侧）
pnpm lint           # ESLint
pnpm format         # Prettier
pnpm build          # 类型检查 + 构建三端产物到 out/
pnpm build:unpack   # 构建并打出未压缩目录包 dist/win-unpacked（可直接运行验证）
pnpm build:win      # 构建 Windows NSIS 安装包 dist/*-setup.exe
pnpm build:mac      # 构建 macOS dmg（需在 macOS 上执行）
```

## 目录速览

```
src/
├─ main/        # 主进程：窗口创建 + SQLite（better-sqlite3）+ IPC handler
├─ preload/     # 预加载脚本：contextBridge 暴露类型安全的 window.api
├─ renderer/    # 渲染进程：React + Tailwind + shadcn/ui
└─ shared/      # 三端共享的 TS 类型（IPC 契约）
```

## 说明

- `better-sqlite3@13` 起改用 N-API 预编译，包内自带全平台二进制，
  在 Electron 中无需 electron-rebuild；模板的 `postinstall` 仍会执行
  `electron-builder install-app-deps` 兜底处理原生依赖。
- `.npmrc` 配置了 Electron / electron-builder 二进制的国内镜像。
