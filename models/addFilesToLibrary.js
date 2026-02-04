const { parentPort } = require('worker_threads')
const fs = require('fs')

const getAudioFileMetadata = require('../models/getAudioFileMetadata')
const TAGLIB_ACCESSORS = require('../models/getTaglibAccessors')

parentPort.on('message', ({ chunks, chunk }) => {
  const files = []
  const now = Date.now()
  for (const file of chunks[chunk]) {
    if (fs.lstatSync(file).isDirectory()) continue

    // parse supported files and extract their metadata
    let specialType = null // special types are files with metadata that isn't supported by taglib
    if (file.endsWith('.spc')) specialType = 'spc' // SPC (super nintendo audio file)
    if (
      file.endsWith('m4a') || // AAC or ALAC
      file.endsWith('.flac') || // FLAC
      file.endsWith('.mp3') || // MP3
      file.endsWith('.opus') || // Opus
      file.endsWith('.ogg') || // Opus or Vorbis
      file.endsWith('.wav') || // WAV
      file.endsWith('.aif') || file.endsWith('.aiff') || // AIFF
      file.endsWith('.wma') || // Windows Media Audio
      specialType
    ) {
      const metadata = getAudioFileMetadata({
        file,
        specialType,
        skipBinaries: true // prevents the picture data from being serialized, which would slow things down a lot
      })

      // set columns to write to the database
      const columnsForDb = [
        file,
        now
      ]
      TAGLIB_ACCESSORS.forEach(key => {
        if (key !== 'pictures') { // prevents the picture data from being serialized, which would slow things down a lot
          // postprocess the metedata to prepare it for being written to the db
          if (typeof metadata[key] === 'object') metadata[key] = JSON.stringify(metadata[key])
          else if (typeof metadata[key] === 'number' || typeof metadata[key] === 'boolean') metadata[key] = `${metadata[key]}`
          else if (!metadata[key]) metadata[key] = ''
          columnsForDb.push(metadata[key])
        }
      })
      files.push(columnsForDb)
    }
  }

  // tell the parent process the worker is done
  parentPort.postMessage(files)
})
