// handles native menus
const { Menu, MenuItem } = require('electron')
const mainWindow = global.mainWindow

module.exports = () => {
  // menu bar edits
  const menu = Menu.getApplicationMenu()
  const items = menu?.items.filter((item) => {
    /*
      available options:
      appmenu
      filemenu
      editmenu
      viewmenu
      windowmenu
      help
    */
    switch (item.role) {
      case 'viewmenu': return process.env.DEV_MODE // display only in dev mode
      case 'help': return false // hide by default
      default: return true
    }
  })

  let newItem

  // add a "Settings..." menu item to the file menu in linux/windows or the app menu in macOS
  newItem = new MenuItem({
    label: 'Settings...',
    click: () => { console.log('settings screen not implemented yet') }
  })
  for (const item of items) {
    if (process.platform === 'darwin' && item.role === 'appmenu') {
      item.submenu.insert(1, new MenuItem({ type: 'separator' }))
      item.submenu.insert(1, newItem)
      item.submenu.insert(1, new MenuItem({ type: 'separator' }))
      break
    } else if (process.platform !== 'darwin' && item.role === 'filemenu') {
      item.submenu.insert(0, newItem)
      item.submenu.insert(1, new MenuItem({ type: 'separator' }))
    }
  }

  // add a "New Playlist" menu item to the file menu
  newItem = new MenuItem({
    label: 'New Playlist',
    click: () => {
      mainWindow.webContents.send('updateUI', { action: 'newPlaylist' })
    }
  })
  for (const item of items) {
    if (item.role === 'filemenu') {
      item.submenu.insert(0, newItem)
      item.submenu.insert(1, new MenuItem({ type: 'separator' }))
    }
  }

  // set app menu
  Menu.setApplicationMenu(Menu.buildFromTemplate(items))
}
