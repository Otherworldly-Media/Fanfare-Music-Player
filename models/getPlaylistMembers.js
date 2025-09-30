const electron = window ? window.electron : global

module.exports = async (params) => {
  const files = await electron.db.query(`
    select library.*
    from library
    inner join playlist_members
      on library.file_path = playlist_members.file_path
    where playlist_members.playlist = ?`,
  [params.playlist])
  return files
}
