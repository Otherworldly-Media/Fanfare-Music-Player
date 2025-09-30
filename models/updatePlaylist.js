const electron = window ? window.electron : global

module.exports = async (params) => {
  if (params.newName) {
    await electron.db.query('update playlists set name = ? where name = ?', [params.newName, params.name])
    await electron.db.query('update playlist_members set playlist = ? where playlist = ?', [params.newName, params.name])
  } else if (params.resequence) await electron.db.query('update playlists set position = ? where name = ?', params.resequence)
}
