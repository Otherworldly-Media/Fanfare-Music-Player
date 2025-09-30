const Tabulator = require('tabulator-tables')

module.exports = async (files) => {
  if (!files.length) {
    document.getElementById('fileList').setAttribute('hidden', 'hidden')
    document.querySelector('#content article p').removeAttribute('hidden')
    return
  }
  document.getElementById('fileList').removeAttribute('hidden')
  document.querySelector('#content article p').setAttribute('hidden', 'hidden')

  window.columns = [
    { title: 'file_path', field: 'file_path', visible: false }, // an invisible 'file_path' row is required and reserved for programmatic use elsewhere in the app
    {
      title: '',
      field: 'playback_image',
      width: 26,
      minWidth: 26,
      maxWidth: 26,
      formatter: (cell) => {
        const value = cell.getValue()
        let title = ''
        let svg = ''
        switch (value) {
          case 'play-queue': {
            title = 'This file is in the play queue'
            svg = '<svg class="play-queue" height="800" viewBox="0 0 256 256" width="800" xmlns="http://www.w3.org/2000/svg"><path d="m137.33123 196.48001a13.714606 13.714606 0 0 1 -13.71428 13.71428h-109.714286a13.71429 13.71429 0 0 1 0-27.42857h109.714286a13.714606 13.714606 0 0 1 13.71428 13.71429zm118.85714-36.57143a13.715211 13.715211 0 0 1 -6.4453 11.62945l-73.14286 45.71429a13.714286 13.714286 0 0 1 -20.98327-11.62945v-91.42858a13.714286 13.714286 0 0 1 20.98327-11.62947l73.14286 45.71429a13.715211 13.715211 0 0 1 6.4453 11.62947zm-39.5904 0-33.55245-20.97043v41.94084zm-202.695306-96.00001h201.142846a13.714286 13.714286 0 0 0 0-27.42857h-201.142846a13.714286 13.714286 0 0 0 0 27.42857zm109.714286 45.71429h-109.714286a13.71429 13.71429 0 0 0 0 27.42858h109.714286a13.71429 13.71429 0 0 0 0-27.42858z" stroke-width="1.14286"/></svg>'
            break
          }
          case 'volume-off': {
            title = 'This is the currently playing file, but it is paused'
            svg = '<svg class="volume-off" height="800" viewBox="0 0 16 16" width="800" xmlns="http://www.w3.org/2000/svg"><path d="m4 5h-4v6h4l5 4v-14z"/></svg>'
            break
          }
          case 'volume-up': {
            title = 'This is the currently playing file'
            svg = '<svg class="volume-up" height="800" viewBox="0 0 16 16" width="800" xmlns="http://www.w3.org/2000/svg"><path d="m15 8.5c0 2.3-.8 4.5-2 6.2l.7.8c1.5-1.9 2.4-4.4 2.4-7 0-3.1-1.2-5.9-3.2-8l-.5 1c1.6 1.8 2.6 4.3 2.6 7z"/><path d="m11.8 2.4-.5 1c1.1 1.4 1.7 3.2 1.7 5.1 0 1.7-.5 3.2-1.3 4.6l.7.8c1.1-1.5 1.7-3.4 1.7-5.4-.1-2.3-.9-4.4-2.3-6.1z"/><path d="m10.8 4.4-.5 1.1c.5.9.8 1.9.8 3 0 1-.3 2-.7 2.9l.7.9c.6-1.1 1-2.4 1-3.7-.1-1.6-.5-3-1.3-4.2z"/><path d="m4 5h-4v6h4l5 4v-14z"/></svg>'
            break
          }
        }
        return value ? `<div class="playback_image" title="${title}">${svg}</div>` : ''
      }
    },
    { title: 'Artist', field: 'firstPerformer' },
    { title: 'Album', field: 'album' },
    { title: 'Title', field: 'title' },
    { title: 'Year', field: 'year' },
    { title: 'File Path', field: 'file_path' }
  ]

  const table = new Tabulator('#fileList', {
    data: files, // assign data to table
    columns: window.columns,
    index: 'file_path',
    height: window.innerHeight - document.querySelector('#header').offsetHeight - 1,
    layout: 'fitColumns', // ensures columns fit within the table width
    selectableRows: true,
    selectableRowsRangeMode: 'click',
    movableRows: true,
    movableRowsConnectedElements: ['#playlistList'],
    initialSort: [
      { column: 'firstPerformer', dir: 'asc' }
    ],
    rowFormatter: function (row) {
      const rowIndex = row.getPosition(true) // true = position in currently displayed data
      if (rowIndex % 2 === 0) {
        row.getElement().classList.add('even-row')
        row.getElement().classList.remove('odd-row')
      } else {
        row.getElement().classList.add('odd-row')
        row.getElement().classList.remove('even-row')
      }
    }
  })
  window.table = table
  require('ui/initSearchControls')()

  // play a file
  table.on('rowDblClick', (event, row) => window.playAudioFile(row.getData().file_path))

  // when right clicking on a file; most of this logic is handled by the electron-context-menu stuff elsewhere; only cosmetic things are handled here
  table.on('rowContext', (event, row) => {
    if (!row.isSelected()) {
      table.deselectRow() // deselect all rows
      row.select()
    }
  })

  // when dragging a file
  table.on('rowMoving', function (toTables) {
    document.body.classList.add('copyCursor')
    window.draggingTabulatorRow = true
  })
  table.on('movableRowsElementDrop', async function (event, element, row) {
    let playlist
    if (event.target.nodeName === 'SPAN') playlist = event.target.innerHTML
    else playlist = event.target.querySelector('span').innerHTML
    const selectedData = table.getSelectedRows().map(row => row.getData())
    const files = []
    for (const file of selectedData) files.push(file.file_path)
    await require('models/addFilesToPlaylist')({ playlist, files })
  })
}

// detect that we are currently hovering over a playlist element in order to style it as a drop target
window.draggingTabulatorRow = false
document.addEventListener('mousemove', (event) => {
  if (window.draggingTabulatorRow) {
    document.body.classList.add('copyCursor')
    document.querySelector('.draggingAudioFilesOverPlaylist')?.classList.remove('draggingAudioFilesOverPlaylist')
    const hoveredElement = document.elementFromPoint(event.clientX, event.clientY)
    if (document.getElementById('playlistList').contains(hoveredElement)) {
      let li = hoveredElement
      if (hoveredElement.nodeName !== 'LI') li = hoveredElement.closest('li')
      li.classList.add('draggingAudioFilesOverPlaylist')
    }
  }
})

// release drag action when the mouseup event occurs
document.addEventListener('mouseup', () => {
  window.draggingTabulatorRow = false
  document.body.classList.remove('copyCursor')
  document.querySelector('.draggingAudioFilesOverPlaylist')?.classList.remove('draggingAudioFilesOverPlaylist')
})

// resize tabulator table when the window resizes
window.addEventListener('resize', () => {
  if (typeof window.table !== 'undefined') {
    window.addTitleToEllipsisOnPlaybackMetadata()
    try {
      window.table.setHeight(window.innerHeight - document.querySelector('#header').offsetHeight - 1)
    } catch (error) {
      // swallow error: tabulator sometimes throws useless errors when doing this
    }
  }
})

// see if playback metadata has an ellipsis
window.addTitleToEllipsisOnPlaybackMetadata = () => {
  const fileTitleEl = document.getElementById('fileTitle')
  if (fileTitleEl && fileTitleEl.scrollWidth > fileTitleEl.clientWidth) fileTitleEl.title = fileTitleEl.innerHTML
  else fileTitleEl.removeAttribute('title')
  const artistInfo = document.getElementById('artistInfo')
  if (artistInfo && artistInfo.scrollWidth > artistInfo.clientWidth) artistInfo.title = artistInfo.textContent
  else artistInfo.removeAttribute('title')
}
