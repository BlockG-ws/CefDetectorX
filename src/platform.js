const { exec } = require('child_process')
const fs = require('original-fs').promises
const path = require('path')

const isWindows = process.platform === 'win32'
const isLinux = process.platform === 'linux'

const execAsync = cmd => new Promise(resolve => exec(cmd, { maxBuffer: 1000 * 1000 * 10, windowsHide: true }, (err, stdout, stderr) => {
  if (err || stderr) console.error(err || stderr)
  resolve(stdout || '')
}))

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
    const cmd = isRegex ? `"${esPath}" -regex ${pattern}` : `"${esPath}" -s ${pattern}`
    return execAsync(cmd)
  } else if (isLinux) {
    // Use find and locate on Linux
    if (isRegex) {
      // For regex patterns, use find with regex
      // Convert Windows-style regex to POSIX if needed
      const searchDirs = ['/usr', '/opt', '/home', '/var']
      const results = await Promise.all(
        searchDirs.map(dir =>
          execAsync(`find ${dir} -type f -regextype posix-extended -regex '.*${pattern}' 2>/dev/null || true`)
        )
      )
      return results.join('\n')
    } else {
      // For simple string search, try locate first (faster), fallback to find
      let result = await execAsync(`locate "${pattern}" 2>/dev/null || true`)
      if (!result.trim()) {
        // Fallback to find if locate doesn't work or returns nothing
        const searchDirs = ['/usr', '/opt', '/home', '/var']
        const results = await Promise.all(
          searchDirs.map(dir =>
            execAsync(`find ${dir} -type f -name "*${pattern}*" 2>/dev/null || true`)
          )
        )
        result = results.join('\n')
      }
      return result
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
      // On Linux, check execute permission
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
