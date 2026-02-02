// this file is the renderer (browser-side) process of the app
const electron = window.electron // a list of functions exposed from the main process that the renderer is allowed to call

async function init () {
  // semantic forms ui library js support https://github.com/kethinov/semanticforms
  require('semantic-forms')()

  // tippy ui tooltip library https://github.com/atomiks/tippyjs
  window.tippy = require('tippy.js/dist/tippy.cjs.js').default

  // create a css variable reflecting the operating system highlight color
  electron.onAccentColor((color) => {
    if (color.length === 9) color = color.substring(0, color.length - 2) // remove the FF at the end
    document.documentElement.style.setProperty('--accent-color', color)
    document.documentElement.style.setProperty('--row-highlight', color)
    window.accentColor = color
    window.defocusedAccentColor = '#e0e0e0'
    window.contrastColor = require('models/pickTextColorBasedOnBgColor')(window.accentColor, '#ffffff', '#000000')
    document.documentElement.style.setProperty('--accent-color-contrast-color', window.contrastColor)
  })

  // show confirm quit dialog when quitting the app
  electron.listen('confirmExit', async () => {
    const result = await electron.confirmExit() // tell the main process to spin up a confirmation dialog
    if (result.response === 0) await electron.exit() // yes
    else return false // no
  })

  // add defocused class to body tag if the window is defocused
  window.addEventListener('blur', () => {
    document.body.classList.add('defocused')
    document.documentElement.style.setProperty('--row-highlight', window.defocusedAccentColor)
    window.contrastColor = require('models/pickTextColorBasedOnBgColor')(window.defocusedAccentColor, '#ffffff', '#000000')
    document.documentElement.style.setProperty('--accent-color-contrast-color', window.contrastColor)
  })

  // remove defocused class from body tag if the window is focused
  window.addEventListener('focus', () => {
    document.body.classList.remove('defocused')
    document.documentElement.style.setProperty('--row-highlight', window.accentColor)
    window.contrastColor = require('models/pickTextColorBasedOnBgColor')(window.accentColor, '#ffffff', '#000000')
    document.documentElement.style.setProperty('--accent-color-contrast-color', window.contrastColor)
  })

  // create dialog element-based modals
  require('ui/initDialogs')()

  // drag/drop files into the app
  window.addEventListener('dragover', (event) => event.preventDefault())
  window.addEventListener('drop', async (event) => {
    event.preventDefault()
    if (event.dataTransfer.files.length) window.electron.sendFiles(event.dataTransfer.files)
  })

  // when the user right clicks, tell the main process what they right clicked on
  window.addEventListener('contextmenu', (event) => {
    const context = {}
    const target = event.target
    if (target.classList.contains('tabulator-cell')) {
      if (window.viewing === 'library') context.is = 'libraryAudioFile'
      if (window.viewing === 'playlist') context.is = 'playlistAudioFile'
      context.selectedFiles = []
      context.currentPlaylist = window.currentPlaylist
      window.table.getSelectedRows().forEach(row => context.selectedFiles.push(row.getData().file_path))
    } else if ((target.nodeName === 'SPAN' && target.parentNode.classList.contains('playlistButton')) || target.classList.contains('playlistButton')) {
      context.is = 'playlistButton'
      if (target.nodeName === 'SPAN') context.playlistName = target.innerHTML
      else context.playlistName = target.querySelector('span').innerHTML
    } else if ((target.nodeName === 'SPAN' && target.parentNode.id === 'audioLibraryPlaylist') || target.id === 'audioLibraryPlaylist') {
      context.is = 'libraryButton'
    }
    electron.setContextMenuUIContext(context)
  })

  // update the ui when the main process asks the renderer to
  electron.listen('updateUI', async (event, message) => {
    if (message.action === 'removeAudioFiles') require('ui/removeAudioFiles')(message.params)
    else if (message.action === 'newPlaylist') require('ui/newPlaylist')()
    else if (message.action === 'renamePlaylist') require('ui/renamePlaylist')(message.params)
    else if (message.action === 'deletePlaylist') require('ui/deletePlaylist')(message.params)
    else if (message.action === 'addDraggedFilesToLibrary') await window.app.triggerRoute({ route: '/addFilesToLibrary', body: { draggedFiles: message.params } })
    else if (message.action === 'refreshLibrary') require('ui/refreshLibrary')()
    else if (message.action === 'deleteLibrary') require('ui/deleteLibrary')()
  })

  // set up router and templating system
  const singlePageExpress = require('single-page-express')
  const templatingEngine = require('teddy/client')
  const templates = require('./.build/templates.js')
  Object.entries(templates).forEach(([name, template]) => templatingEngine.setTemplate(name, template)) // register the templates with the teddy templating system

  // load single page express router
  const app = singlePageExpress({
    expressVersion: 4,
    disableTopbar: true,
    alwaysSkipViewTransition: true,
    templatingEngine,
    templates,
    defaultTarget: 'main > article',
    afterEveryRender: async (model) => {
      // replace title attributes with tippy attributes
      document.querySelectorAll('[title]:not(iframe)')?.forEach(titleAttribute => { // apply tippy tooltip to any element with html title attribute
        if (!titleAttribute.getAttribute('data-tippy-skip')) {
          if (titleAttribute.getAttribute('title') === 'Clear field') return // skip semantic forms clear fields
          window.tippy(titleAttribute, {
            content: titleAttribute.getAttribute('title'), // extract tooltip content from html title attribute
            placement: titleAttribute.getAttribute('data-tippy-placement') || 'top' // allow html elements to customize tooltip placement
          })
          titleAttribute.removeAttribute('title') // remove html title attribute as it is now redundant and fights with tippy
        }
      })

      // confirm boxes for delete buttons
      document.querySelectorAll('button[name="delete"], button[data-delete="true"]')?.forEach(deleteButton => {
        deleteButton.addEventListener('click', async event => {
          if (await window.confirmDialog({ html: event.target.getAttribute('data-delete-message') ? `<p>${event.target.getAttribute('data-delete-message')}</p>` : '<p>Are you sure you want to delete this?</p>' })) {
            return true
          } else {
            event.preventDefault()
            return false
          }
        })
      })

      // prevent submitting noSubmit forms
      document.querySelectorAll('form.noSubmit')?.forEach(form => {
        form.addEventListener('submit', (event) => {
          event.preventDefault()
        })
      })
    }
  })
  window.app = app

  // load routes
  require('./.build/routes.js')(app)

  // load the app skeleton
  await app.triggerRoute({ route: '/' })
}

document.addEventListener('DOMContentLoaded', init)
