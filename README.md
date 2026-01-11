# CEF Detector X - 一眼CEF X: 年轻人的第二款 CEF检测器 [![Release](https://github.com/ShirasawaSama/CefDetectorX/actions/workflows/release.yml/badge.svg)](https://github.com/ShirasawaSama/CefDetectorX/actions/workflows/release.yml)

Check how many CEFs are on your Windows or Linux.

**【2 代使用 Electron 编写并提供更多功能】**

看看你电脑 **(Windows/Linux)** 上有多少个 [CEF (Chromium Embedded Framework)](https://bitbucket.org/chromiumembedded/cef/).

> **Note**
> 欢迎你把程序截图发到 [Discussions](https://github.com/ShirasawaSama/CefDetectorX/discussions/17) 中, 看看谁才是真的 **《超级CEF王》**

> 你说的对，但是《LibCEF》是由谷歌自主研发的一款全新开放浏览器内核。第三方代码运行在在一个被称作「CEF」的浏览器沙盒，在这里，被前端程序员选中的代码将被授予「libcef.dll」，导引浏览器之力‌。你将扮演一位名为「电脑用户」的冤种角色，在各种软件的安装中下载类型各异、体积庞大的 CEF 们，被它们一起占用硬盘空间，吃光你的内存——同时，逐步发掘「CEF」的真相。

## 截屏

![Screenshot](./screenshot.png)

## 使用

### Windows

**你首先需要安装 [Everything](https://www.voidtools.com/) 并完成全硬盘的扫描.**

从 [Release](https://github.com/ShirasawaSama/CefDetectorX/releases) 页面下载最新的压缩包 (CefDetectorX.zip 或 CefDetectorX-with-bgm.zip), 解压后运行 `CefDetectorX.exe` 即可.

> **Warning**
> 不支持精简版Everything, 它不允许 [IPC](https://www.voidtools.com/zh-cn/support/everything/sdk/ipc/)

### Linux

从 [Release](https://github.com/ShirasawaSama/CefDetectorX/releases) 页面下载最新的 Linux 压缩包 (CefDetectorX-linux.zip 或 CefDetectorX-with-bgm-linux.zip), 解压后运行:

```bash
chmod +x CefDetectorX
./CefDetectorX
```

**建议先运行 `sudo updatedb` 来更新文件索引以获得更快的搜索速度 (使用 mlocate/plocate).**

**推荐安装 [fd](https://github.com/sharkdp/fd) 来获得更快的文件搜索速度:**

```bash
# Debian/Ubuntu
sudo apt install fd-find

# Arch Linux
sudo pacman -S fd

# Fedora
sudo dnf install fd-find
```

> **Note**
> Linux 版本会自动检测并使用 `fd` (如果已安装) 或回退到 `find` 命令进行文件搜索. 如果系统没有安装 `mlocate` 或 `plocate`, 首次搜索可能会比较慢.


## 特性

- 跨平台支持: Windows 和 Linux
- 检测 CEF 的类型: 如 [libcef](https://bitbucket.org/chromiumembedded/cef/src/master/)、[Electron](https://www.electronjs.org/)、[NWJS](https://nwjs.io/)、[CefSharp](http://cefsharp.github.io/)、[MiniBlink](https://github.com/weolar/miniblink49)、[MiniElectron](https://github.com/weolar/miniblink49)、[Edge](https://www.microsoft.com/en-us/edge) 和 [Chrome](https://www.google.com/chrome/)
- 显示总空间占用
- 显示当前所运行的进程 (绿色文件名)
- 单独显示每个程序的空间占用并按大小排序
- 支持自定义背景音乐 (默认为: [The Magnificent Seven](https://soundcloud.com/7kruzes/the-magnificent-seven), 替换 resources/app/bgm.mp3 即可)
- 可以通过添加参数 `--no-bgm` 的形式来关闭背景音乐

## 作者

Shirasawa

创意来自 @Lakr233 的 [SafariYYDS](https://github.com/Lakr233/SafariYYDS) 项目.

## 协议

[MIT](./LICENSE)
