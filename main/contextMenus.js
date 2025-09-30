// handles native context menus
const { dialog, ipcMain } = require('electron')
const mainWindow = global.mainWindow
const db = global.db
let menu = [] // gets reset every context menu invocation

module.exports = async () => {
  // standard context menus
  const ContextMenu = await import('electron-context-menu')
  const contextMenu = ContextMenu.default
  contextMenu({ // options documented here: https://github.com/sindresorhus/electron-context-menu
    showSearchWithGoogle: false,
    showCopyImage: false,
    prepend: (defaultActions, params, browserWindow) => {
      if (global.contextMenuUIContext.is) {
        menu = []
        switch (global.contextMenuUIContext.is) {
          case 'libraryButton': {
            resetLibrary()
            return menu
          }
          case 'playlistButton': {
            renamePlaylist()
            return menu
          }
          case 'libraryAudioFile': {
            removeFromLibrary()
            return menu
          }
          case 'playlistAudioFile': {
            removeFiles()
            removeFromLibrary()
            return menu
          }
          default: return []
        }
      } return []
    }
  })
}

function renamePlaylist () {
  menu.push(
    {
      label: 'Rename playlist',
      click: async () => {
        mainWindow.webContents.send('updateUI', { action: 'renamePlaylist', params: global.contextMenuUIContext.playlistName })
      }
    },
    {
      label: 'Delete playlist',
      click: async () => {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Confirm',
          buttons: ['No', 'Yes'],
          defaultId: 0,
          cancelId: 1,
          message: 'Are you sure you want to delete this playlist?'
        })
        if (result.response === 1) {
          db.query('delete from playlists where name=?', [global.contextMenuUIContext.playlistName])
          mainWindow.webContents.send('updateUI', { action: 'deletePlaylist', params: global.contextMenuUIContext.playlistName })
        }
      }
    }
  )
}

function resetLibrary () {
  menu.push(
    {
      label: 'Reset library',
      click: async () => {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Confirm',
          buttons: ['No', 'Yes'],
          defaultId: 0,
          cancelId: 1,
          message: 'Are you sure you want to reset your library?'
        })
        if (result.response === 1) {
          db.query('delete from library')
          mainWindow.webContents.send('updateUI', { action: 'deleteLibrary' })
        }
      }
    }
  )
}

async function removeFiles () {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Confirm',
    buttons: ['No', 'Yes'],
    defaultId: 0,
    cancelId: 1,
    message: `Are you sure you want to remove ${global.contextMenuUIContext.selectedFiles.length > 1 ? 'these files' : 'this file'} from your playlist?`
  })
  if (result.response === 1) {
    const files = []
    for (const file of global.contextMenuUIContext.selectedFiles) files.push([file, global.contextMenuUIContext.currentPlaylist])
    db.query('delete from playlist_members where file_path=? and playlist=?', files)
    mainWindow.webContents.send('updateUI', { action: 'removeAudioFiles', params: global.contextMenuUIContext.selectedFiles })
  }
  if (global.contextMenuUIContext.selectedFiles.length > 1) menu.push({ label: 'Remove files from playlist', click: removeFiles })
  else menu.push({ label: 'Remove file from playlist', click: removeFiles })
}

function removeFromLibrary () {
  const deleteFiles = async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Confirm',
      buttons: ['No', 'Yes'],
      defaultId: 0,
      cancelId: 1,
      message: `Are you sure you want to remove ${global.contextMenuUIContext.selectedFiles.length > 1 ? 'these files' : 'this file'} from your library?`
    })
    if (result.response === 1) {
      const files = []
      for (const file of global.contextMenuUIContext.selectedFiles) files.push([file])
      db.query('delete from library where file_path=?', files)
      db.query('delete from playlist_members where file_path=?', files)
      mainWindow.webContents.send('updateUI', { action: 'removeAudioFiles', params: global.contextMenuUIContext.selectedFiles })
    }
  }
  if (global.contextMenuUIContext.selectedFiles.length > 1) menu.push({ label: 'Remove files from library', click: deleteFiles })
  else menu.push({ label: 'Remove file from library', click: deleteFiles })
}

// handle context menu calls from renderer
global.contextMenuUIContext = null
ipcMain.handle('setContextMenuUIContext', (event, info) => { global.contextMenuUIContext = info })
