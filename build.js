const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

const platform = process.platform
const isWindows = platform === 'win32'
const isLinux = platform === 'linux'

const files = [
  ...fs.readdirSync('src').map(it => ['src/' + it, 'resources/app/' + it]),
  'LICENSE',
  'README.md'
]

// Only include es.exe for Windows builds
if (isWindows && fs.existsSync('es.exe')) {
  files.push('es.exe')
}

const electronRoot = path.resolve(require.resolve('electron'), '../dist')
const appName = 'CefDetectorX'
const exeName = isWindows ? 'electron.exe' : 'electron'
const targetName = isWindows ? `${appName}.exe` : appName

const walkDir = dir => fs.promises.readdir(dir).then(list => Promise.all(list.map(async file => {
  const cur = path.join(dir, file)
  if ((await fs.promises.stat(cur)).isDirectory()) await walkDir(cur)
  else {
    const name = path.relative(electronRoot, cur).replace(/\\/g, '/')
    if (name === 'LICENSE' || name.startsWith('resources/')) return
    // Rename electron executable to CefDetectorX
    files.push([cur, name.startsWith(exeName) ? targetName + name.replace(new RegExp('^' + exeName), '') : name])
  }
})))

const ZIP_OPTIONS = { type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }

const buildForPlatform = async () => {
  const zip = new JSZip()
  const suffix = isLinux ? '-linux' : isWindows ? '' : `-${platform}`
  const outputWithBgm = `${appName}-with-bgm${suffix}.zip`
  const outputNoBgm = `${appName}${suffix}.zip`
  
  await walkDir(electronRoot)
  await Promise.all(files.map(it => fs.promises.readFile(typeof it === 'string' ? it : it[0])
    .then(data => zip.file(`${appName}/` + (typeof it === 'string' ? it : it[1]), data))))
  
  console.log('Building', platform, 'package with', Object.keys(zip.files).length, 'files')
  
  // Build with BGM
  const dataWithBgm = await zip.generateAsync(ZIP_OPTIONS)
  await fs.promises.writeFile(outputWithBgm, dataWithBgm)
  console.log('Created', outputWithBgm)
  
  // Build without BGM
  zip.remove(`${appName}/resources/app/bgm.mp3`)
  const dataNoBgm = await zip.generateAsync(ZIP_OPTIONS)
  await fs.promises.writeFile(outputNoBgm, dataNoBgm)
  console.log('Created', outputNoBgm)
}

buildForPlatform().catch(err => {
  console.error('Build failed:', err)
  process.exit(1)
})
