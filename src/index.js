const { shell, ipcRenderer } = require('electron')
const fs = require('original-fs').promises
const path = require('path')
const platform = require('./platform')

document.getElementsByTagName('a')[0].onclick = () => shell.openExternal('https://github.com/ShirasawaSama/CefDetectorX')

let cnt = 0
let totalSize = 0
const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
const exists = file => fs.stat(file).then(it => it.isFile(), () => false)
const dirSize = async (dir, cache = { }, deep = 0) => {
  if (deep > 10) return
  try {
    const stats = await fs.stat(dir)
    if (cache[stats.ino]) return
    cache[stats.ino] = true
    totalSize += stats.size
    if (stats.isDirectory()) {
      await Promise.all((await fs.readdir(dir)).map(it => dirSize(path.join(dir, it), cache, deep + 1)))
    }
  } catch { }
}

const LIBCEF = 'cef_string_utf8_to_utf16'
const ELECTRON = 'third_party/electron_node'
const ELECTRON2 = 'register_atom_browser_web_contents'
const CEF_SHARP = 'CefSharp.Internals'
const NWJS = 'url-nwjs'
const MINI_ELECTRON = 'napi_create_buffer'
const MINI_BLINK = 'miniblink'

ipcRenderer
  .invoke('has-args', 'no-bgm')
  .then(async val => {
    if (val) return
    if (await exists(path.join(__dirname, 'bgm.mp3'))) {
      const audio = new Audio('bgm.mp3')
      audio.autoplay = true
      audio.loop = true
      audio.controls = true
      document.body.appendChild(audio)
    } else {
      const iframe = document.createElement('iframe')
      iframe.src = 'https://music.163.com/outchain/player?type=2&id=5264829&auto=1&height=32'
      iframe.frameBorder = 0
      iframe.border = 0
      iframe.marginwidth = 0
      iframe.marginheight = 0
      iframe.width = 280
      iframe.height = 52
      document.body.appendChild(iframe)
    }
  })

const prettySize = len => {
  let order = 0
  while (len >= 1024 && order < sizes.length - 1) {
    order++
    len /= 1024
  }
  return len.toFixed(2) + ' ' + sizes[order]
}

const cache = { }
const nodes = []
const mainElm = document.getElementsByTagName('main')[0]
const titleElm = document.getElementsByTagName('h2')[0]
const addApp = async (file, type, isDir = false) => {
  console.log('Found:', type, file)
  if (cache[file]) return
  const prevSize = totalSize
  await dirSize(isDir ? file : path.dirname(file))
  cache[file] = true
  const elm = document.createElement('section')
  const fileName = path.basename(file)
  elm.title = file
  nodes.push([totalSize - prevSize, elm])
  const icon = await ipcRenderer.invoke('get-app-icon', file)
  elm.innerHTML = (icon ? `<img src="data:image/png;base64,${icon}" alt="${fileName}">` : '<h3>?</h3>') +
    `<h6 class=${!isDir && processes[file] ? 'running' : ''}>${fileName}</h6><p>${type}</p><sub>${prettySize(totalSize - prevSize)}</sub>`
  elm.onclick = () => isDir ? shell.openPath(file) : shell.showItemInFolder(file)
  mainElm.appendChild(elm)

  titleElm.innerText = `这台电脑上总共有 ${++cnt} 个 Chromium 内核的应用 (${prettySize(totalSize)})`
}

const processes = await platform.getRunningProcesses()

const search = async (file) => {
  console.log('Searching:', file)
  try {
    // Check for Edge
    let f = path.join(file, platform.isWindows ? 'msedge.exe' : 'microsoft-edge')
    if (await exists(f)) {
      await addApp(f, 'Edge')
      return [true]
    }
    // Check for Chrome
    const chromeLauncher = platform.isWindows ? 'chrome_pwa_launcher.exe' : 'chrome_pwa_launcher'
    const chromeExe = platform.isWindows ? '../chrome.exe' : '../chrome'
    if (await exists(path.join(file, chromeLauncher)) && await exists(f = path.join(file, chromeExe))) {
      await addApp(f, 'Chrome')
      return [true]
    }
    let firstExe
    const executables = await platform.getExecutables(file)
    for (const it of executables) {
      const fileName = path.join(file, it)
      const data = await fs.readFile(fileName)
      const fileNameLowerCase = it.toLowerCase()
      let type
      if (data.includes(ELECTRON) || data.includes(ELECTRON2)) type = 'Electron'
      else if (data.includes(NWJS)) type = 'NWJS'
      else if (data.includes(CEF_SHARP)) type = 'CefSharp'
      else if (data.includes(LIBCEF)) type = 'CEF'
      else if (!firstExe && !fileNameLowerCase.includes('unins') && !fileNameLowerCase.includes('setup') && !fileNameLowerCase.includes('report')) {
        firstExe = fileName
        continue
      } else continue
      await addApp(fileName, type)
      return [true]
    }
    return [false, firstExe]
  } catch (e) {
    console.error(e)
    return [false]
  }
}

const cache2 = { }
const searchCef = async (stdout, defaultType = 'Unknown') => {
  for (const file of stdout.replace(/\r/g, '').split('\n')) {
    if (!file.trim()) continue
    // Skip recycle bin and temp locations (cross-platform)
    if (file.includes('$RECYCLE.BIN') || file.includes('OneDrive') ||
        file.includes('/.Trash') || file.includes('/.cache') ||
        /\.log$/i.test(file)) continue
    const dir = path.dirname(file)
    if (cache2[dir]) continue
    cache2[dir] = true
    if (await fs.stat(file).then(it => it.isDirectory(), () => true)) continue
    let res = await search(dir)
    if (res[0]) continue
    if (res[1]) await addApp(res[1], defaultType)
    else {
      res = await search(path.dirname(dir))
      if (res[0]) continue
      if (res[1]) await addApp(res[1], defaultType)
      else await addApp(dir, defaultType, true)
    }
  }
}
// Search for Chrome Resource Localization files (cross-platform)
await searchCef(await platform.searchFiles('_100_(.+?)\\.pak$', true))
// Search for libcef library files (flexible pattern to catch all versions)
if (platform.isWindows) {
  await searchCef(await platform.searchFiles('libcef'), 'CEF')
} else {
  // On Linux, search for libcef.so and its versioned variants (e.g., libcef.so.123)
  await searchCef(await platform.searchFiles('libcef.*\\.so', true), 'CEF')
  // Also search for .dll files on Linux (for Wine or cross-platform scenarios)
  await searchCef(await platform.searchFiles('libcef.*\\.dll', true), 'CEF')
}

// Search for Node.js native modules (Electron, Mini Blink, etc.)
const nodePattern = platform.isWindows ? 'node.*\\.dll' : 'node.*\\.(so|dll)'
for (const file of (await platform.searchFiles(nodePattern, true)).replace(/\r/g, '').split('\n')) {
  if (!file.trim()) continue
  if (file.includes('$RECYCLE.BIN') || file.includes('OneDrive') ||
      file.includes('/.Trash') || file.includes('/.cache')) continue
  if (await fs.stat(file).then(it => it.isDirectory(), () => true)) continue
  const dir = path.dirname(file)
  const executables = await platform.getExecutables(dir)
  for (const it of executables) {
    const fileName = path.join(dir, it)
    const data = await fs.readFile(fileName)
    let type
    if (data.includes(MINI_ELECTRON)) type = 'Mini Electron'
    else if (data.includes(MINI_BLINK)) type = 'Mini Blink'
    else continue
    await addApp(fileName, type)
    break
  }
}

if (nodes.length) nodes.sort(([a], [b]) => b - a).forEach(([_, elm], i) => (elm.style.order = i.toString()))
else {
  if (platform.isWindows) {
    titleElm.innerText = '这台电脑上没有 Chromium 内核的应用 (也有可能是你没装 Everything)'
  } else {
    titleElm.innerText = '这台电脑上没有 Chromium 内核的应用 (尝试安装 fd 和运行 sudo updatedb 来提高搜索效果)'
  }
}
titleElm.className = 'running'
