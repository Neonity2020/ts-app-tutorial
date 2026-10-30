# TypeScript 全栈实录（下）：从一行命令，到用户手里的安装包

> 上篇我们搞懂了 Electron 的三层架构并跑通第一个窗口；中篇接入 shadcn/ui 与 better-sqlite3，用一条类型链贯通了「前端 → IPC → SQLite」的增删改查与自动保存。
>
> 本篇是完结篇：**用 electron-builder 打出 Windows / macOS 安装包，并把这个系列踩过的所有坑做个了结。**

## 一、为什么 dev 能跑 ≠ 能发给别人？

想一个问题：你的记事本现在能跑，靠的是什么？

- Electron 本体（一个定制版 Chromium + Node.js，约 100MB）
- `node_modules` 里的一堆依赖（包括 C++ 编译的 better-sqlite3）
- Vite 构建出来的 `out/` 产物

用户机器上这些**一个都没有**。所谓打包，就是把这三样东西按目标平台的规矩组装起来，变成一个双击能装的 `.exe`（Windows）或 `.dmg`（macOS）。

干这件事的标准工具是 **electron-builder**——好消息是，electron-vite 脚手架已经把它配好了九成，我们主要工作是看懂每一行配置。

## 二、看懂 electron-builder.yml

脚手架生成的 `electron-builder.yml`，改完后的关键部分如下（注释是我加的）：

```yaml
appId: com.mininote.app        # 应用唯一标识，反向域名惯例，装完就定终身别改
productName: MiniNote          # 显示名称：安装包、快捷方式都用它（数据目录由 package.json 的 productName 决定，中篇已设）
directories:
  buildResources: build        # 图标等资源目录

files:                         # 哪些东西进安装包（! 开头是排除项）
  - '!**/.vscode/*'
  - '!src/*'                   # 源码不进包，进包的是 out/ 产物
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  # ……其余排除项……

asarUnpack:
  - resources/**
  # 原生模块必须解包成真实文件，才能被 require 加载
  - node_modules/better-sqlite3/**

win:
  executableName: MiniNote     # 生成的 exe 文件名
nsis:                          # Windows 用 NSIS 技术生成安装向导
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always

mac:                           # macOS 配置，下文细说
  entitlementsInherit: build/entitlements.mac.plist
  # ……（模板自带的 extendInfo 保持不动）……
  notarize: false
dmg:
  artifactName: ${name}-${version}.${ext}
```

两个概念值得单独讲。

**① asar：把整个应用装进一个「虚拟文件系统」。** Electron 打包时默认把源码和依赖压成一个 `app.asar` 归档（防止用户随手翻改文件）。但有个例外——C++ 原生模块（`.node` 文件）必须以**真实文件**存在才能被动态加载。electron-builder 的 smartUnpack 通常会自动解包它们；保险起见，我们还是用 `asarUnpack` 把 better-sqlite3 显式声明出来，意图更清晰。

**② files 排除的是「开发用的东西」。** 注意排除的是 `src/`（源码）和一堆 tsconfig——进包的其实是 electron-vite build 产出的 `out/` 目录。构建与打包，职责分明。

## 三、Windows 实战：一条命令出安装包

```bash
pnpm build:win
```

这个脚本背后是两步：`pnpm run build`（类型检查 + 三端构建）然后 `electron-builder --win`（打包）。跑完看终端输出：

```text
• packaging       platform=win32 arch=x64 electron=44.10.0 appOutDir=dist\win-unpacked
• building        target=nsis file=dist\notepad-app-1.0.0-setup.exe archs=x64
• building block map  blockMapFile=dist\notepad-app-1.0.0-setup.exe.blockmap
```

📷 **【截图占位 1：build:win 成功后的终端输出】**

`dist/` 目录里最关键的是两个东西：

- `win-unpacked/` —— 解压即用版，里面 `MiniNote.exe` 双击就能跑，适合自己快速验证；
- `notepad-app-1.0.0-setup.exe` —— **NSIS 安装包**，发给用户的东西，双击后自动安装、创建桌面快捷方式，控制面板里还能规范地卸载。

💡 **两个高频问题提前回答：**

**① 双击安装时 Windows 弹「SmartScreen 已保护你的电脑」？** 因为我们没有买代码签名证书，Windows 对来路不明的程序都会提示。个人项目点「仍要运行」即可；商业项目需要购买代码签名证书（OV 约几百到几千元/年），在 `electron-builder.yml` 里配上 `win.certificateSubjectName` 即可自动签名。

**② 打包时下载 NSIS 工具链卡住/报错？** 老朋友了，和上篇装 Electron 一样是网络问题——`.npmrc` 里配好的 `electron_builder_binaries_mirror` 镜像就是为这一步准备的，确认它存在，重新跑即可。

## 四、macOS 差异清单 🍎

macOS 的打包命令是：

```bash
pnpm build:mac    # 注意：需要在 macOS 机器上执行
```

产物是一个 `dmg`——用户双击打开，把 app 图标拖进 Applications 文件夹完成安装。流程之外，还有五处和 Windows 不一样的地方：

**① 图标格式不同。** Windows 用 `build/icon.ico`（建议 256×256 起），macOS 用 `build/icon.icns`。把你的 PNG 丢进 [icon.kitchen](https://icon.kitchen) 这类工具一键生成全套即可，文件名不变，electron-builder 自动取用。

**② 芯片架构。** Mac 用户手里有 Intel（x64）和 Apple Silicon（arm64）两种机器。默认打出来的包跟当前机器架构走；要同时支持，配置双架构：

```yaml
mac:
  target:
    - target: dmg
      arch: [x64, arm64]     # 或用 universal 出一个通用包（体积翻倍）
```

**③「关闭窗口」≠「退出应用」。** 这不是打包问题，而是 macOS 的交互惯例：点红色关闭按钮后，应用应该还驻留在 Dock 里，再点 Dock 图标要能唤回窗口。好消息是脚手架的主进程代码已经写好了这两条惯例：

```ts
// 除了 macOS，其他平台关闭所有窗口就退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS：点击 Dock 图标且没有窗口时，重新创建一个窗口
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

**④ 公证（Notarization）。** 别人的 Mac 打开你的 app 如果报「无法验证开发者」，是因为没有公证。公证需要 Apple Developer 账号（$99/年），流程是把应用上传给 Apple 扫描后盖戳。我们的模板里 `notarize: false` 即跳过此步；正式分发时改成：

```yaml
mac:
  notarize: true   # 配合环境变量 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
```

**⑤ 数据目录长这样：** `~/Library/Application Support/MiniNote/`。排障时直接去这里找 `mininote.db`。

## 五、应用数据去哪了？——一个必须想清楚的问题

中篇我们把数据库放在 `app.getPath('userData')`，现在补上它在两个平台的实际落点：

| 平台 | userData 路径 |
| --- | --- |
| Windows | `C:\Users\用户名\AppData\Roaming\MiniNote\` |
| macOS | `~/Library/Application Support/MiniNote/` |

⚠️ 注意：这一路径由 Electron 运行时读取 **package.json 的 `productName`** 决定（中篇已设为 `MiniNote`），跟 electron-builder.yml 里的 productName 无关。如果你的数据跑去了 `%AppData%\notepad-app\`，先检查这一行。

再次强调**为什么不能把数据写进安装目录**：

1. Windows 下 Program Files 受写保护，普通权限根本写不进去；
2. 用户升级或卸载应用时，安装目录会被整个替换/删除——数据跟着陪葬；
3. 多用户系统里会互相覆盖。

把「程序」和「数据」分开存放，是桌面应用的第一课，`app.getPath()` 就是 Electron 给你准备好的正确入口。

## 六、踩坑复盘：这一路我们排掉的雷

整个系列实战下来，共排掉五颗雷，集中列出，建议收藏：

| # | 坑 | 症状 | 解法 |
| --- | --- | --- | --- |
| 1 | 国内下载 Electron 二进制失败 | `pnpm install` 时 `TypeError: fetch failed` | `.npmrc` 配 `electron_mirror` 镜像 |
| 2 | pnpm v10 拦截构建脚本 | `Ignored build scripts: ...` 警告（v12 及以下的 better-sqlite3 等带安装脚本的包才会触发） | 模板 postinstall 已兜底（`install-electron` + `install-app-deps`）；v13 无安装脚本，不受影响 |
| 3 | shadcn CLI 识别不了 electron-vite | `could not detect a supported framework` | 手写 `components.json`，别名指向 `@renderer` |
| 4 | 原生模块 ABI 不匹配（历史问题） | 老版本 better-sqlite3 在 Electron 里报 `NODE_MODULE_VERSION` 不一致 | v13 起已内置 N-API 预编译免重编译；老版本用 `@electron/rebuild` |
| 5 | 原生模块进 asar 后无法加载 | 打包后启动报 `.node` 文件找不到 | `asarUnpack` 显式解包 better-sqlite3（smartUnpack 兜底，双保险） |

## 七、留给你的练习题

极简不等于简陋，是刻意收敛。以下功能都留了「接口钩子」，作为你的练手任务：

1. **搜索**：给列表加一个搜索框，`listNotes` 加一个 `keyword` 参数，SQL 里 `LIKE '%xxx%'`（顺便体会 prepared statement 的参数化写法）；
2. **暗色主题**：CSS 变量已就位（`.dark` 一整套），加一个主题切换按钮，想想这个「偏好」该存哪？（提示：数据库加一张 settings 表，或 Electron 的 `localStorage`）
3. **启动页记忆**：记住上次选中的笔记 id，启动时直接定位；
4. **导出 Markdown**：主进程里用 `dialog.showSaveDialog` + `fs.writeFile`，体验一下「Node 能力只有主进程有」这件事。

## 八、写在最后

三篇走完，回头看我们其实做了三件事：

- **上篇**建立了「Electron = TS 全栈」的心智模型；
- **中篇**用一套共享类型 + IPC，把 React 前端和 SQLite 后端焊成了一个工程；
- **下篇**把它变成了能安装、能卸载、能交付的真软件。

这套架构不止能做记事本——笔记应用换成待办清单、Markdown 编辑器、本地音乐播放器、内网小工具，骨架都是这一套。Electron 十几年常青，靠的从来不是性能极致，而是**让每一位 Web 开发者都拥有造桌面软件的能力**。

现在，轮到你了。

> 这是本系列的完结篇。如果系列对你有帮助，关注我，下一篇实战系列见 👋
> 有问题欢迎留言，评论区集中答疑。

---

*本系列配套完整源码：`你的仓库地址/notepad-app`（发布时替换为实际地址），含 Windows 安装包构建配置与本文全部代码。*
