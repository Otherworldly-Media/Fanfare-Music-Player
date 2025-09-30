module.exports = async () => {
  window.library = await require('models/getLibrary')()
  window.table.replaceData(window.library)
}
