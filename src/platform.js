const { exec } = require('child_process')
const os = require('os')
const fs = (() => {
  try {
    return require('original-fs').promises
  } catch (e) {
    return require('fs').promises
  }
})()
const path = require('path')

const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'

const execAsync = cmd => new Promise(resolve => exec(cmd, { maxBuffer: 1000 * 1000 * 10, windowsHide: true }, (err, stdout, stderr) => {
  if (err || stderr) console.error(err || stderr)
  resolve(stdout || '')
}))

/**
 * Escape shell argument to prevent command injection
 * @param {string} arg - Argument to escape
 * @returns {string} - Escaped argument
 */
function escapeShellArg (arg) {
  if (isWindows) {
    // Windows escaping
    return '"' + arg.replace(/(["%])/g, '^$1') + '"'
  } else {
    // POSIX shell escaping
    return "'" + arg.replace(/'/g, "'\\''") + "'"
  }
}

// Detect which search tool is available on Linux
let linuxSearchTool = null
const detectLinuxSearchTool = async () => {
  if (linuxSearchTool !== null) return linuxSearchTool
  // Try fd first (it might be named 'fd' or 'fdfind' on Debian/Ubuntu)
  const result = await execAsync('command -v fd 2>/dev/null || command -v fdfind 2>/dev/null || true')
  if (result.trim()) {
    linuxSearchTool = result.trim().includes('fdfind') ? 'fdfind' : 'fd'
    console.log('Using search tool:', linuxSearchTool)
    return linuxSearchTool
  }
  // Fallback to find
  linuxSearchTool = 'find'
  console.log('Using search tool: find (consider installing fd for faster searches)')
  return linuxSearchTool
}

/**
 * Search for files matching a pattern
 * @param {string} pattern - Search pattern (regex or simple string)
 * @param {boolean} isRegex - Whether the pattern is a regex
 * @returns {Promise<string>} - Newline-separated list of file paths
 */
async function searchFiles (pattern, isRegex = false) {
  if (isWindows) {
    // Use Everything on Windows
    const esPath = path.join(__dirname, '../es.exe')
    const cmd = isRegex ? `"${esPath}" -regex ${escapeShellArg(pattern)}` : `"${esPath}" -s ${escapeShellArg(pattern)}`
    return execAsync(cmd)
  } else if (isLinux) {
    const tool = await detectLinuxSearchTool()
    const homeDir = os.homedir()
    const searchDirs = ['/usr/lib', '/usr/local', '/opt', '/snap', homeDir]

    if (tool === 'fd' || tool === 'fdfind') {
      // Use fd for faster searches
      if (isRegex) {
        // For regex patterns, use fd with regex support
        const promises = searchDirs.map((dir, idx) => {
          const maxDepth = idx === searchDirs.length - 1 ? '--max-depth 6' : '' // Limit depth in home
          return execAsync(`${tool} ${maxDepth} --type f --regex ${escapeShellArg(pattern)} ${escapeShellArg(dir)} 2>/dev/null || true`)
        })
        const results = await Promise.all(promises)
        return results.join('\n')
      } else {
        // For simple string search, try locate first (faster), fallback to fd
        let result = await execAsync(`locate ${escapeShellArg(pattern)} 2>/dev/null | head -n 1000 || true`)
        if (!result.trim()) {
          // Fallback to fd
          const promises = searchDirs.map((dir, idx) => {
            const maxDepth = idx === searchDirs.length - 1 ? '--max-depth 6' : ''
            return execAsync(`${tool} ${maxDepth} --type f ${escapeShellArg(pattern)} ${escapeShellArg(dir)} 2>/dev/null || true`)
          })
          const results = await Promise.all(promises)
          result = results.join('\n')
        }
        return result
      }
    } else {
      // Fallback to find
      if (isRegex) {
        // For regex patterns, use find with regex in common app directories
        const searchDirs = ['/usr/lib', '/usr/local', '/opt', '/snap']
        const promises = searchDirs.map(dir =>
          execAsync(`find ${escapeShellArg(dir)} -type f -regextype posix-extended -regex ${escapeShellArg('.*' + pattern)} 2>/dev/null || true`)
        )
        // Also search in home directory but limit depth
        promises.push(execAsync(`find ${escapeShellArg(homeDir)} -maxdepth 6 -type f -regextype posix-extended -regex ${escapeShellArg('.*' + pattern)} 2>/dev/null || true`))
        const results = await Promise.all(promises)
        return results.join('\n')
      } else {
        // For simple string search, try locate first (faster), fallback to find
        let result = await execAsync(`locate ${escapeShellArg(pattern)} 2>/dev/null | head -n 1000 || true`)
        if (!result.trim()) {
          // Fallback to find if locate doesn't work or returns nothing
          const searchDirs = ['/usr/lib', '/usr/local', '/opt', '/snap']
          const promises = searchDirs.map(dir =>
            execAsync(`find ${escapeShellArg(dir)} -type f -name ${escapeShellArg('*' + pattern + '*')} 2>/dev/null || true`)
          )
          promises.push(execAsync(`find ${escapeShellArg(homeDir)} -maxdepth 6 -type f -name ${escapeShellArg('*' + pattern + '*')} 2>/dev/null || true`))
          const results = await Promise.all(promises)
          result = results.join('\n')
        }
        return result
      }
    }
  }
  return ''
}

/**
 * Get list of running process executable paths
 * @returns {Promise<Object>} - Object with executable paths as keys
 */
async function getRunningProcesses () {
  const processes = {}

  if (isWindows) {
    // Use wmic on Windows
    try {
      const output = await execAsync('wmic process get ExecutablePath')
      output.replace(/\r/g, '').replace(/ +\n/g, '\n').split('\n').forEach(it => {
        if (it.trim()) processes[it] = 1
      })
    } catch (e) {
      console.error(e)
    }
  } else if (isLinux) {
    // Use /proc filesystem on Linux
    try {
      const pids = await fs.readdir('/proc')
      for (const pid of pids) {
        if (!/^\d+$/.test(pid)) continue
        try {
          const exePath = await fs.readlink(path.join('/proc', pid, 'exe'))
          if (exePath) processes[exePath.replace(/ \(deleted\)$/, '')] = 1
        } catch (e) {
          // Process may have exited or we don't have permission
          continue
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  return processes
}

/**
 * Get executable extension for the current platform
 * @returns {string} - Executable extension (.exe for Windows, empty for Linux)
 */
function getExeExtension () {
  return isWindows ? '.exe' : ''
}

/**
 * Check if a file is an executable
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} - True if the file is executable
 */
async function isExecutable (filePath) {
  try {
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) return false

    if (isWindows) {
      // On Windows, check file extension
      return filePath.toLowerCase().endsWith('.exe')
    } else if (isLinux) {
      // On Linux, check execute permission (0o111 = execute bit for owner, group, or other)
      return (stats.mode & 0o111) !== 0
    }
  } catch (e) {
    return false
  }
  return false
}

/**
 * Get list of executable files in a directory
 * @param {string} dir - Directory path
 * @returns {Promise<string[]>} - List of executable file names
 */
async function getExecutables (dir) {
  try {
    const files = await fs.readdir(dir)
    const executables = []

    for (const file of files) {
      const filePath = path.join(dir, file)
      if (await isExecutable(filePath)) {
        executables.push(file)
      }
    }

    return executables
  } catch (e) {
    return []
  }
}

module.exports = {
  isWindows,
  isLinux,
  searchFiles,
  getRunningProcesses,
  getExeExtension,
  isExecutable,
  getExecutables
}
