module.exports = async (params) => {
  const table = window.table
  params.forEach(filePath => {
    const rows = table.getRows().filter(row => row.getData().file_path === filePath)
    rows.forEach(row => row.delete())
  })

  // re-apply banding to all visible rows
  table.getRows('active').forEach((row, idx) => {
    const rowIndex = row.getPosition(true) // true = position in currently displayed data
    if (rowIndex % 2 === 0) {
      row.getElement().classList.add('even-row')
      row.getElement().classList.remove('odd-row')
    } else {
      row.getElement().classList.add('odd-row')
      row.getElement().classList.remove('even-row')
    }
  })

  // check if table is empty
  if (table.getRows(true).length === 0) {
    if (window.viewing === 'playlist') {
      await window.app.triggerRoute({ route: '/displayPlaylist', body: { playlist: window.currentPlaylist } })
    }
  } else require('ui/deleteLibrary')()

  if (window.viewing === 'playlist') window.library = await require('models/getLibrary')()
}
