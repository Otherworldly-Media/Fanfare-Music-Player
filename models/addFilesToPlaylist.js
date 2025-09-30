const electron = window ? window.electron : global

module.exports = async (params) => {
  for (const file of params.files) await electron.db.query('insert or ignore into playlist_members (playlist, file_path) values (?, ?)', [params.playlist, file])
}
