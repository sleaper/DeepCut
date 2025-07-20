import { existsSync, mkdirSync, chmodSync, readdirSync } from 'fs'
import path from 'path'
import { ytDlpPath } from '@/index'

// Import as a CommonJS module to fix Electron compatibility
const YTDlpWrap = require('yt-dlp-wrap').default

let ytDlpWrap: any | null = null

export async function initializeYTDlp() {
  if (ytDlpWrap) return ytDlpWrap

  console.log('ytDlpPath', ytDlpPath)

  if (!existsSync(ytDlpPath)) {
    mkdirSync(ytDlpPath, { recursive: true })
  }

  // Check if yt-dlp binary exists, if not download it
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const binaryPath = path.join(ytDlpPath, binaryName)

  console.log('Looking for binary at:', binaryPath)

  if (!existsSync(binaryPath)) {
    console.log('📥 yt-dlp binary not found, downloading...')
    try {
      await YTDlpWrap.downloadFromGithub(ytDlpPath)
      console.log('✅ yt-dlp binary downloaded successfully')

      // List directory contents to see what was actually downloaded
      const dirContents = readdirSync(ytDlpPath)
      console.log('Directory contents after download:', dirContents)

      // Verify the binary was actually created
      if (!existsSync(binaryPath)) {
        throw new Error(
          `Binary not found at expected path: ${binaryPath}. Directory contents: ${dirContents.join(', ')}`
        )
      }

      // Make binary executable on Unix systems
      if (process.platform !== 'win32') {
        chmodSync(binaryPath, '755')
      }
    } catch (error) {
      console.error('❌ Failed to download yt-dlp binary:', error)
      throw error
    }
  }

  console.log('Initializing YTDlpWrap with binary at:', binaryPath)

  // Initialize with the full binary path
  ytDlpWrap = new YTDlpWrap(binaryPath)
  return ytDlpWrap
}
