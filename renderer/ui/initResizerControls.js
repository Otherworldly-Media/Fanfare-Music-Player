const electron = window.electron

module.exports = () => {
  if (window.resizerControlsInitialized) return
  window.resizerControlsInitialized = true

  let resizing = false

  // resize sidebar
  const sidebarResizer = document.querySelector('#sidebarResizer')
  const sidebarResizerHalfWidth = sidebarResizer.offsetWidth / 2
  const sidebar = document.querySelector('#sidebar')
  const sidebarSettingsWidth = electron.store.get('sidebarListWidth')
  if (sidebarSettingsWidth) sidebar.style.width = sidebarSettingsWidth
  else sidebar.style.width = '200px'
  const header = document.getElementById('header')
  const headerStyles = window.getComputedStyle(header)
  const sidebarTabs = document.querySelector('#sidebarTabs')
  const sidebarsTabStyles = window.getComputedStyle(sidebarTabs)
  function setSidebarContentBoxDimensions () {
    document.getElementById('artwork').style.width = sidebar.offsetWidth + 'px'
    document.getElementById('artwork').style.height = sidebar.offsetWidth + 'px'
    const usedHeight = header.offsetHeight + sidebar.offsetWidth + sidebarTabs.offsetHeight + parseInt(sidebarsTabStyles.marginTop) + parseInt(sidebarsTabStyles.marginBottom) + parseInt(headerStyles.borderBottomWidth)
    document.getElementById('playlists').style.height = `calc(100vh - ${usedHeight}px)`
    document.getElementById('next').style.height = `calc(100vh - ${usedHeight}px)`
    document.getElementById('history').style.height = `calc(100vh - ${usedHeight}px)`
  }
  setSidebarContentBoxDimensions()

  // sidebar resizer
  const sidebarsStyles = window.getComputedStyle(sidebar)
  const totalPadding = parseInt(sidebarsStyles.paddingLeft) + parseInt(sidebarsStyles.paddingRight)
  sidebarResizer.style.left = (sidebar.offsetWidth - sidebarResizerHalfWidth) + 'px'
  sidebarResizer.addEventListener('mousedown', () => { resizing = 'sidebars' })

  document.addEventListener('mousemove', (event) => {
    if (!resizing) return
    if (resizing === 'sidebars') {
      const containerOffsetLeft = document.querySelector('#content').offsetLeft
      const pointerRelativeXpos = event.clientX - containerOffsetLeft - totalPadding
      sidebarResizer.style.left = (sidebar.offsetWidth - sidebarResizerHalfWidth) + 'px'
      sidebar.style.width = pointerRelativeXpos + 'px'
      setSidebarContentBoxDimensions()
    }
  })

  document.addEventListener('mouseup', () => {
    if (resizing === 'sidebars') electron.store.set('sidebarListWidth', sidebar.style.width)
    resizing = false
  })
}
