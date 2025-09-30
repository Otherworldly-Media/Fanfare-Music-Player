module.exports = async () => {
  const newName = await window.promptDialog({ label: 'New playlist name', defaultValue: '' })

  // ensure new name is unique
  if (newName) {
    let unique = true
    const playlist = newName
    document.querySelectorAll('[data-playlist-name]').forEach((el) => {
      if (playlist === el.getAttribute('data-playlist-name')) unique = false
    })
    if (!unique) window.alertDialog({ html: '<p>There is already a playlist with that name.</p>' })
    else {
      await require('models/newPlaylist')(playlist)
      document.querySelector('#playlistList').insertAdjacentHTML('beforeend', `<li><button type="submit" name="playlist" value="${playlist}" class="playlistButton"><img src="renderer://images/playlist.svg" width="16" height="16"><span>${playlist}</span></button></li>`)
    }
  }
}
