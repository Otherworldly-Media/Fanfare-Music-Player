const electron = window ? window.electron : global

module.exports = async (params) => {
  const files = await electron.db.query('select * from library')
  return files
}
