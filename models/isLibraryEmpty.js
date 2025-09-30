const electron = window ? window.electron : global

module.exports = async (params) => {
  const files = await electron.db.query('select file_path from library limit 1')
  return files.length < 1
}
