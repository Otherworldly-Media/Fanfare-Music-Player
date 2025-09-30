module.exports = async () => {
  window.table.clearData()
  delete window.library
  await window.app.triggerRoute({ route: '/addFilesToLibrary' })
}
