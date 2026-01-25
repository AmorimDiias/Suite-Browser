import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProfileManager } from './profiles'
import { launchProfile, stopProfile, setMainWindow } from './engine'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon, // Aplica o ícone em todas as plataformas (Windows/Linux)
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win

  // Pass reference to engine for IPC communication
  setMainWindow(mainWindow)

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('get-profiles', async () => {
    return await ProfileManager.getAll()
  })

  ipcMain.handle('create-profile', async (_, data) => {
    return await ProfileManager.create(data)
  })

  ipcMain.handle('update-profile', async (_, { id, data }) => {
    return await ProfileManager.update(id, data)
  })

  ipcMain.handle('delete-profile', async (_, id) => {
    return await ProfileManager.delete(id)
  })

  ipcMain.on('launch-profile', async (_, profileId) => {
    console.log('Launch requested for:', profileId)
    try {
      await launchProfile(profileId)
    } catch (error) {
      console.error('Failed to launch profile:', error)
    }
  })

  ipcMain.on('stop-profile', async (_, profileId) => {
    console.log('Stop requested for:', profileId)
    try {
      await stopProfile(profileId)
    } catch (error) {
      console.error('Failed to stop profile:', error)
    }
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
