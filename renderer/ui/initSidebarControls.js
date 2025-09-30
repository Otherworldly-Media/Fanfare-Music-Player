const electron = window.electron
const { Sortable } = require('sortablejs')

module.exports = () => {
  if (window.sidebarControlsInitialized) return
  window.sidebarControlsInitialized = true

  // sidebar tabs
  document.getElementById('sidebarTabs').addEventListener('click', selectSidebarTab)
  function selectSidebarTab (event) {
    let selectedTab = document.forms.sidebarTabs.tab.value
    if (typeof event === 'string') selectedTab = event
    if (typeof event === 'string' || event.target.nodeName === 'INPUT') {
      document.querySelectorAll('#sidebarTabs label').forEach((el) => {
        el.className = ''
        document.getElementById(el.querySelector('input').value).setAttribute('hidden', 'hidden')
      })
      document.getElementById(selectedTab + 'Tab').parentNode.className = 'selected'
      document.getElementById(selectedTab).removeAttribute('hidden')
      electron.store.set('selectedSidebarTab', selectedTab)
    }
  }
  if (electron.store.get('selectedSidebarTab')) selectSidebarTab(electron.store.get('selectedSidebarTab'))

  // make playlists sortable
  Sortable.create(document.getElementById('playlistList'), {
    // persist new sequence in the sqlite db
    onEnd: async () => {
      const resequence = []
      let c = 0
      document.querySelectorAll('#playlistList span').forEach((el) => {
        c++
        resequence.push([c, el.innerHTML])
      })
      await require('models/updatePlaylist')({ resequence })
    }
  })
}
