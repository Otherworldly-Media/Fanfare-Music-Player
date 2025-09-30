module.exports = (app) => {
  app.route('/displayPlaylist').get(async (req, res) => {
    res.target = '#content > article'
    let members = ''
    let playlist = req.body?.playlist
    if (!playlist || playlist === 'Library') {
      playlist = 'Library'
      window.viewing = 'library'
      window.library = window.library || await require('models/getLibrary')()
      members = window.library
    } else {
      window.viewing = 'playlist'
      window.currentPlaylist = playlist
      members = await require('models/getPlaylistMembers')({ playlist })
    }
    res.render('displayFiles', {}, async () => {
      await require('ui/renderAudioFileList')(members)
      document.querySelectorAll('form[action="/displayPlaylist"] span').forEach((el) => {
        if (el.innerHTML === playlist) el.parentNode.classList.add('selected')
        else el.parentNode.classList.remove('selected')
      })
    })
  })
}
