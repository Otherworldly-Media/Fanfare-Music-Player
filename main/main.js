// this file is the main (node.js) process of the app
const { app, protocol, net, shell, dialog, BrowserWindow, ipcMain, systemPreferences, globalShortcut } = require('electron')
const path = require('path')
const url = require('url')

// set global variables that will be defined later
let mainWindow
let store

// get system preferences
const accentColor = systemPreferences.getAccentColor()

// create main window
async function createWindow () {
  if (process.env.DEV_MODE) console.log('  • user data location:', app.getPath('userData'))
  console.log() // print a new line

  // implement a renderer:// protocol for loading images locally
  protocol.handle('renderer', async (request) => {
    const filePath = request.url.slice('renderer://'.length)
    return await net.fetch(url.pathToFileURL(path.join(__dirname, '/../renderer/', filePath)).toString())
  })

  // setup settings store
  const Store = (await import('electron-store')).default
  store = new Store()
  global.store = store

  // get previous window size if it was different than the defaults
  const mainWindowState = require('electron-window-state')({
    defaultWidth: 1600,
    defaultHeight: 720
  })

  // create the main window
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 900,
    minHeight: 670,
    show: false,
    autoHideMenuBar: true,
    frame: process.platform !== 'darwin', // use native frame for linux/windows, custom frame for macOS
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // use hiddenInset for macOS, default for others
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 18 } : undefined, // only apply traffic light position for macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  global.mainWindow = mainWindow

  // setting autohide to true and then calling this event helps prevent a flash of unstyled content
  mainWindow.on('ready-to-show', () => mainWindow.show())

  // show the menu bar by default on linux/windows
  if (process.platform !== 'darwin') mainWindow.setMenuBarVisibility(true)

  // load the renderer
  mainWindow.loadFile(path.join(__dirname, '../renderer/renderer.html'))
  if (process.env.DEV_MODE) mainWindow.webContents.openDevTools()

  // save main window size when it is resized
  mainWindowState.manage(mainWindow)

  // set native menus
  require('./contextMenus')()
  require('./menuBar')()

  // clear global reference to main window if the window is closed
  mainWindow.on('closed', () => { mainWindow = null })

  // inform renderer of close event
  mainWindow.on('close', event => {
    event.preventDefault()
    mainWindow.webContents.send('confirmExit')
  })

  // send accent color to renderer and inject as a css variable
  mainWindow.webContents.on('did-finish-load', () => mainWindow.webContents.send('setAccentColor', `#${accentColor}`))

  // handle OS media keys
  globalShortcut.register('MediaPlayPause', () => mainWindow.webContents.send('mediaPlayPause'))
  globalShortcut.register('MediaNextTrack', () => mainWindow.webContents.send('mediaNextTrack'))
  globalShortcut.register('MediaPreviousTrack', () => mainWindow.webContents.send('mediaPreviousTrack'))
}

// this method will be called when electron has finished initialization and is ready to create browser windows
// some apis can only be used after this event occurs
app.on('ready', createWindow)

// quit when all windows are closed, except on macOS
// there, it's common for applications and their menu bar to stay active until the user quits explicitly with cmd + q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// on macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// disable navigation https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault() // disable all navigation inside the app itself
    shell.openExternal(require('@braintree/sanitize-url').sanitizeUrl(navigationUrl)) // open the link externally but the url needs to be sanitized first because https://www.electronjs.org/docs/latest/tutorial/security#14-disable-or-limit-creation-of-new-windows
    return { action: 'deny' }
  })
})

// handle exit confirmation dialog calls from renderer
ipcMain.handle('confirmExit', async (event, fileName) => {
  const result = await dialog.showMessageBox({
    type: 'question',
    title: 'Confirm',
    buttons: ['Yes', 'No'],
    defaultId: 0,
    cancelId: 1,
    message: 'Are you sure you want to quit?'
  })
  return result
})

// unregister global shortcuts when quitting the app
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// handle app exit calls from renderer
ipcMain.handle('exit', () => {
  app.exit()
})

// handle electron-store calls from renderer
ipcMain.on('storeGet', (event, params) => { event.returnValue = store.get(params.key) })
ipcMain.on('storeSet', (event, params) => { event.returnValue = store.set(params.key, params.value) })
ipcMain.on('storeDelete', (event, params) => { event.returnValue = store.delete(params.key) })

// set up sqlite db
const Database = require('better-sqlite3')
const sqliteDb = new Database(path.join(app.getPath('userData'), 'oMusic.sqlite'))
sqliteDb.pragma('journal_mode = WAL')
const db = {
  query: (query, params) => {
    let result
    if (!query.trim().toLowerCase().startsWith('select')) {
      if (params && typeof params[0] === 'object') {
        // it's an array of objects or an array of arrays, so perform a transaction
        const transaction = sqliteDb.prepare(query)
        const transactionRunner = sqliteDb.transaction((paramsArray) => {
          for (const param of paramsArray) {
            transaction.run(param)
          }
        })
        result = transactionRunner(params)
      } else {
        result = sqliteDb.prepare(query).run(params || [])
      }
    } else {
      result = sqliteDb.prepare(query).all(params || [])
    }
    return result || null
  }
}
global.db = db
require('../models/newDatabase')()

// handle sqlite calls from renderer
ipcMain.handle('dbQuery', async (event, query, params) => {
  return db.query(query, params)
})

// handle open directory calls from renderer
ipcMain.handle('openDir', async () => {
  const result = dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result
})

// include code related to audio file library management
require('./library')
