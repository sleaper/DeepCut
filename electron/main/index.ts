import { app, shell, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// @ts-ignore TODO:
import icon from '../../resources/icon.png?asset'
import { createIPCHandler } from 'electron-trpc/main'
import { router } from './ipc'
import { existsSync } from 'fs'

const dataDir = app.getPath('userData')
export const audioDir = join(dataDir, 'audio')
export const clipsDir = join(dataDir, 'clips')
export const transcriptsDir = join(dataDir, 'transcripts')
export const ytDlpPath = join(dataDir, 'yt-dlp')

// Register custom protocol as standard and secure
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'clips',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: false
    }
  }
])

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    resizable: true,
    backgroundColor: '#242424',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  createIPCHandler({ router, windows: [mainWindow] })

  mainWindow.on('ready-to-show', () => {
    // Add a small delay to ensure theme is properly applied
    mainWindow.show()

    // Focus the window to ensure it's in the foreground
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Register custom protocol for serving clip files
  protocol.handle('clips', async (request) => {
    try {
      const url = new URL(request.url)
      const clipId = url.hostname

      // Try both naming conventions and verify the file is in clips directory
      const filePath = join(clipsDir, `${clipId}.mp4`)

      // Security check: ensure the resolved path is within clips directory
      if (!filePath.startsWith(clipsDir)) {
        return new Response('Access denied', { status: 403 })
      }

      if (existsSync(filePath)) {
        // Read and serve the actual file content
        const { readFile } = await import('fs/promises')
        const fileBuffer = await readFile(filePath)

        return new Response(fileBuffer, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': fileBuffer.length.toString(),
            'Accept-Ranges': 'bytes'
          }
        })
      }

      // File not found
      return new Response('File not found', { status: 404 })
    } catch (error) {
      console.error('Protocol handler error:', error)
      return new Response('Failed to handle request', { status: 500 })
    }
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
