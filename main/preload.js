// this file exposes functions to the renderer that allow it to execute code in the main process
const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // exposes method to renderer to allow it to listen to events emitted by the main process
  listen: (channel, callback) => ipcRenderer.on(channel, callback),

  // allows the renderer to get the operating system's accent color for styling purposes
  onAccentColor: (callback) => ipcRenderer.on('setAccentColor', (event, color) => callback(color)),

  // allows the renderer to bring up the confirm quit native dialog
  confirmExit: async (...args) => await ipcRenderer.invoke('confirmExit', ...args),

  // handle OS media keys
  mediaPlayPause: async (...args) => await ipcRenderer.invoke('mediaPlayPause', ...args),
  mediaNextTrack: async (...args) => await ipcRenderer.invoke('mediaNext', ...args),
  mediaPreviousTrack: async (...args) => await ipcRenderer.invoke('mediaPrevious', ...args),

  // allows the renderer to quit the app
  exit: async () => await ipcRenderer.invoke('exit'),

  // allows the renderer to trigger native context menus and supply context as to what was right clicked on
  setContextMenuUIContext: async (...args) => await ipcRenderer.invoke('setContextMenuUIContext', ...args),

  // allows the renderer to send files to the main process
  sendFiles: async (fileList) => {
    const filePaths = []
    for (const i in fileList) filePaths.push(webUtils.getPathForFile(fileList[i]))
    ipcRenderer.invoke('files-dropped', filePaths)
  },

  // allows the renderer to set/get/delete settings stored to electron-store
  store: {
    get: key => ipcRenderer.sendSync('storeGet', { action: 'get', key }),
    set: (key, value) => ipcRenderer.sendSync('storeSet', { action: 'set', key, value }),
    delete: key => ipcRenderer.sendSync('storeDelete', { action: 'delete', key })
  },

  // allows the renderer to execute sql queries against the sqlite database
  db: {
    query: async (...args) => await ipcRenderer.invoke('dbQuery', ...args)
  },

  // allows the renderer to open an open directory dialog
  openDir: async (...args) => await ipcRenderer.invoke('openDir', ...args),

  // allows the renderer to scan a directory for audio files to create the library playlist
  addFilesToLibrary: async (...args) => await ipcRenderer.invoke('addFilesToLibrary', ...args),

  // open file metadata and send it to the renderer
  getAudioFileMetadata: async (params) => {
    const metadata = await ipcRenderer.invoke('getAudioFileMetadata', params) // request metadata from the main process
    return metadata
  },

  // open binary data and send the binary to the renderer
  getBinaryData: async (file) => {
    const binaryData = await ipcRenderer.invoke('getBinaryData', file) // request binary data from the main process
    return binaryData
  },

  // open binary data, convert it to flac, and send the binary to the renderer
  convertToFlacBuffer: async (file) => {
    const binaryData = await ipcRenderer.invoke('convertToFlacBuffer', file) // request binary data from the main process
    return binaryData
  }
})
