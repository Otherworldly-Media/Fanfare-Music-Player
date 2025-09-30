module.exports = async (playlist) => {
  document.querySelector(`[data-playlist-name="${playlist}"]`).parentNode.remove()
}
