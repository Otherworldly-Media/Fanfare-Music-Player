const fs = require('fs')
const { readSPCID666Tags } = require('spc-tag')
const taglibSharp = require('node-taglib-sharp')
const TAGLIB_ACCESSORS = require('./getTaglibAccessors')

function getAudioFileMetadata (params) {
  const file = params.file
  const specialType = params.specialType // special types are file types that can't be processed by taglib
  const metadata = {}
  if (!specialType) { // if specialType is not declared, we assume it's a type that can be parsed by taglib
    try {
      const myFile = taglibSharp.File.createFromPath(file, '')
      TAGLIB_ACCESSORS.forEach(key => {
        metadata[key] = myFile.tag[key]
        if (!params.skipBinaries && key === 'pictures' && Array.isArray(myFile.tag.pictures)) {
          // serialize each picture object so that it can be transferred to the renderer
          metadata.pictures = myFile.tag.pictures.map(pic => ({
            mimeType: pic.mimeType || pic._mimeType,
            description: pic.description || pic._description,
            type: pic.type || pic._type,
            width: pic.width || pic._width,
            height: pic.height || pic._height,
            colorDepth: pic.colorDepth || pic._colorDepth,
            data: Buffer.from(pic.data || pic._data?.data || []).toString('base64') // convert the image data to a base64 string
          }))
        }
      })
    } catch (error) {
      console.error(`${error.message} in file ${file}`)
    }
  } else if (specialType === 'spc') { // spc is the super nintendo file format
    // load metadata with spc-tag
    const id666Tags = readSPCID666Tags(fs.readFileSync(file))
    TAGLIB_ACCESSORS.forEach(key => {
      // map spc metadata to taglib metadata normalizations
      switch (key) {
        case 'album': {
          metadata[key] = id666Tags.ost || id666Tags.gameTitle
          break
        }
        case 'beatsPerMinute': {
          break
        }
        case 'comment': {
          metadata[key] = id666Tags.comments
          break
        }
        case 'copyright': {
          metadata[key] = `© ${id666Tags.publisherName}`
          break
        }
        case 'disc': {
          metadata[key] = id666Tags.ostDisc
          break
        }
        case 'genres': {
          metadata[key] = ['Chiptune']
          break
        }
        case 'performers': {
          metadata[key] = [id666Tags.artist]
          break
        }
        case 'firstPerformer': {
          metadata[key] = id666Tags.artist
          break
        }
        case 'performersRole': {
          metadata[key] = ['Programmer']
          break
        }
        case 'publisher': {
          metadata[key] = id666Tags.publisherName
          break
        }
        case 'replayGainTrackGain': {
          break
        }
        case 'subtitle': {
          metadata[key] = `From ${id666Tags.gameTitle || id666Tags.ost}`
          break
        }
        case 'title': {
          metadata[key] = id666Tags.songTitle
          break
        }
        case 'track': {
          metadata[key] = id666Tags.ostTrack
          break
        }
        case 'year': {
          metadata[key] = id666Tags.copyrightYear
          break
        }
        default: metadata[key] = null
      }
    })
    // set spc-specific metadata
    metadata.spcDumper = id666Tags.dumper
    metadata.spcDumpDate = id666Tags.dumpDate
    metadata.spcDefaultChannelDisables = id666Tags.defaultChannelDisables
    metadata.spcEmulatorUsed = id666Tags.emulatorUsed
    metadata.spcIntroLength = id666Tags.introLength
    metadata.spcLoopLength = id666Tags.loopLength
    metadata.spcEndLength = id666Tags.endLength
    metadata.spcFadeLength = id666Tags.fadeLength
    metadata.spcMutedChannels = id666Tags.mutedChannels
    metadata.spcLoopCount = id666Tags.loopCount
  }

  return metadata
}

getAudioFileMetadata.TAGLIB_ACCESSORS = TAGLIB_ACCESSORS
module.exports = getAudioFileMetadata
