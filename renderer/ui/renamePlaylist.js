module.exports = async (playlist) => {
  let originalElement
  document.querySelectorAll('.playlistButton span').forEach((el) => {
    if (el.innerHTML === playlist) originalElement = el
  })

  const newName = await window.promptDialog({ label: 'Set playlist name', defaultValue: playlist })

  let unique = true
  document.querySelectorAll('.playlistButton span').forEach((el) => {
    if (originalElement !== el) {
      if (el.innerHTML === newName) unique = false
    }
  })
  if (!unique) {
    window.alertDialog({ html: '<p>There is already a playlist with that name.</p>' })
  } else {
    if (newName && newName !== playlist) {
      await require('models/updatePlaylist')({ name: playlist, newName })
      originalElement.innerHTML = newName
      originalElement.parentNode.value = newName
    }
  }
}
