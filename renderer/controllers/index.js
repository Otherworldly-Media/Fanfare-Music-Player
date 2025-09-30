module.exports = (app) => {
  app.route('/').get(async (req, res) => {
    const libraryIsEmpty = await require('models/isLibraryEmpty')()
    const model = {}
    model.playlists = await require('models/getPlaylists')()

    res.target = 'body' // first page load should render the entire template; subsequent page loads will only replace the article element because defaultTarget is `main > article`

    res.render('index', model, async () => {
      // init ui elements
      require('ui/initPlaybackControls')()
      require('ui/initSidebarControls')()
      require('ui/initResizerControls')()

      // decide which initial route to load
      if (libraryIsEmpty) await app.triggerRoute({ route: '/addFilesToLibrary' })
      else await app.triggerRoute({ route: '/displayPlaylist' })
    })
  })
}
