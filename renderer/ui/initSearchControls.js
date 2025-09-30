const electron = window.electron

module.exports = () => {
  if (window.searchControlsInitialized) return
  window.searchControlsInitialized = true

  // global search
  document.getElementById('searchBar').addEventListener('input', searchFilter)
  function searchFilter () {
    if (!window.library) return
    const query = document.getElementById('searchBar').value.toLowerCase()
    const searchColumns = ['firstPerformer', 'album', 'title', 'year'] // excludes file_path
    if (typeof table !== 'undefined') {
      window.table.setFilter((data, filterParams) => {
        return searchColumns.some(col => {
          const metadataField = (data[col] || '').toLowerCase()
          const queryWords = query.split(' ')
          for (const word of queryWords) {
            if (!metadataField.includes(word)) {
              return false
            }
          }
          return true
        })
      })
    }
    electron.store.set('searchBarValue', query)

    // re-apply banding to all visible rows
    window.table.getRows('active').forEach((row, idx) => {
      const rowIndex = row.getPosition(true) // true = position in currently displayed data
      if (rowIndex % 2 === 0) {
        row.getElement().classList.add('even-row')
        row.getElement().classList.remove('odd-row')
      } else {
        row.getElement().classList.add('odd-row')
        row.getElement().classList.remove('even-row')
      }
    })
  }

  // add placeholders to search based on actual audio file library
  document.getElementById('searchBar').addEventListener('focus', () => {
    if (!window.library) return
    let tries = 0
    let performer = ''
    while (tries < 43) {
      const randomIndex = Math.floor(Math.random() * window.library.length)
      performer = window.library[randomIndex]?.firstPerformer
      if (performer && performer.trim() !== '') break
      tries++
    }
    if (!performer || performer.trim() === '') performer = 'Nine Inch Nails'
    document.getElementById('searchBar').setAttribute('placeholder', performer)
  })

  // activate search filter when the clear button is clicked
  document.getElementById('searchBar').parentNode.addEventListener('click', (event) => {
    if (event.target.nodeName === 'BUTTON' || event.target.nodeName === 'path' || event.target.nodeName === 'svg') searchFilter()
  })

  // column browser
  document.getElementById('columnBrowserButton').addEventListener('click', async (event) => {
    event.preventDefault()
    if (typeof window.table !== 'undefined') {
      window.alertDialog({ html: '<p>Column browser not implemented yet.</p>' })
    }
  })

  // granular filter fields
  document.getElementById('filterButton').addEventListener('click', (event) => {
    event.preventDefault()
    if (typeof window.table !== 'undefined') {
      if (window.table.getColumns().some(col => col.getDefinition().headerFilter)) {
        // remove header filters
        electron.store.set('filtersOpen', false)
        document.getElementById('filterButton').classList.remove('selected')
        document.querySelector('#filterButton g').setAttribute('fill', '#000')
        window.table.clearFilter(true)
        searchFilter() // apply global search filter
        window.table.setColumns(window.columns.map(col => ({
          ...col,
          headerFilter: null
        })))
      } else {
        // add header filters
        electron.store.set('filtersOpen', true)
        document.getElementById('filterButton').classList.add('selected')
        document.querySelector('#filterButton g').setAttribute('fill', window.accentColor)
        window.table.setColumns(window.columns.map(col => ({
          ...col,
          headerFilter: col.field === 'playback_image' ? null : 'input'
        })))

        // restore previous values
        const savedFilters = electron.store.get('filterValues')
        if (Array.isArray(savedFilters)) {
          savedFilters.forEach(filter => {
            const column = window.table.getColumn(filter.field)
            if (column) {
              const headerFilterElement = column.getElement().querySelector('.tabulator-header-filter input')
              if (headerFilterElement) {
                headerFilterElement.value = filter.value
                headerFilterElement.dispatchEvent(new Event('keyup', { bubbles: true }))
              }
            }
          })
        }
      }
    }
  })

  // lyrics
  document.getElementById('lyricsButton').addEventListener('click', async (event) => {
    event.preventDefault()
    if (typeof window.table !== 'undefined') {
      window.alertDialog({ html: '<p>Lyrics not implemented yet.</p>' })
    }
  })

  // first render
  window.table.on('renderComplete', () => {
    if (!window.tableHasRenderedOnce) {
      window.tableHasRenderedOnce = true

      // restore previous global search
      if (electron.store.get('searchBarValue')) {
        document.getElementById('searchBar').value = electron.store.get('searchBarValue')
        searchFilter()
      }

      // open filters if they were open before
      if (electron.store.get('filtersOpen')) document.getElementById('filterButton').click()

      // monitor column inputs
      window.table.on('dataFiltered', (filters) => {
        const headerFilters = window.table.getHeaderFilters()
        electron.store.set('filterValues', headerFilters)
      })
    }
  })
}
