module.exports = (app) => {
  app.route('/addFilesToLibrary').get(async (req, res) => {
    window.viewing = 'addFilesToLibrary'
    res.target = '#content > article'
    if (req.body?.draggedFiles) {
      // handle files being dragged into the app
      res.render('addFilesToLibrary', {}, async () => {
        const filesToAdd = req.body.draggedFiles
        const filesAdded = []
        await addFilesToLibrary(filesToAdd, filesAdded)
        delete window.library
        await app.triggerRoute({ route: '/displayPlaylist' })
      })
    } else {
      // handle empty library and displaying a button to select a folder
      res.render('addFilesToLibrary', {}, async () => {
        document.getElementById('noAudioFileLibrarySelectFiles').removeAttribute('hidden')
        document.getElementById('selectAudioLibraryDirectory').addEventListener('click', async (event) => {
          event.preventDefault()
          const result = await window.electron.openDir()
          if (result && !result.canceled) {
            const filesToAdd = result.filePaths[0]
            const filesAdded = []
            await addFilesToLibrary(filesToAdd, filesAdded)
          }
          await app.triggerRoute({ route: '/displayPlaylist' })
        })
      })
    }
  })
}

async function addFilesToLibrary (filesToAdd, filesAdded) {
  document.getElementById('noAudioFileLibrarySelectFiles').setAttribute('hidden', 'hidden')
  document.getElementById('selectAudioLibraryDirectoryProgressBar').removeAttribute('hidden')
  let done = false
  let chunk = 0
  while (!done) {
    const chunkResult = await window.electron.addFilesToLibrary(filesToAdd, chunk, filesAdded)
    document.querySelector('progress').setAttribute('max', chunkResult.chunks.length - 1)
    document.querySelector('progress').value = chunk
    filesAdded = chunkResult.filesAdded
    done = chunkResult.done
    chunk++
  }
}
