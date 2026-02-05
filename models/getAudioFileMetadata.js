const fs = require('fs')
const { readSPCID666Tags } = require('spc-tag')
const taglibSharp = require('node-taglib-sharp')
const TAGLIB_ACCESSORS = require('./getTaglibAccessors')

function getAudioFileMetadata (params) {
  // uncomment this to test this method against static data without invoking taglib or analyzing binary data
  // return {
  //   album: 'Test Album',
  //   title: 'Test Title',
  //   performers: ['Test Artist'],
  //   year: 2024
  // }

  const file = params.file
  const specialType = params.specialType // special types are file types that can't be processed by taglib
  const metadata = {}
  if (!specialType) { // if specialType is not declared, we assume it's a type that can be parsed by taglib
    try {
      const myFile = taglibSharp.File.createFromPath(file, '')
      TAGLIB_ACCESSORS.forEach(key => {
        if (key !== 'pictures') {
          metadata[key] = myFile.tag[key]
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

module.exports = getAudioFileMetadata
