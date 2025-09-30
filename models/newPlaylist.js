const electron = window ? window.electron : global

module.exports = async (playlist) => {
  const result = await electron.db.query('select count(*) as count from playlists')
  const totalPlaylists = result[0]?.count || 1
  await electron.db.query('insert into playlists (name, position) values (?, ?)', [playlist, totalPlaylists])
}
