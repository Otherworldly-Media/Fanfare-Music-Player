const electron = window ? window.electron : global

module.exports = async (params) => {
  const playlists = await electron.db.query('select name from playlists order by position')
  const playlistData = []
  for (const playlist of playlists) playlistData.push(playlist.name)
  return playlistData
}
