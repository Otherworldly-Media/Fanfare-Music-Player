const taglibSharp = require('node-taglib-sharp')

function getAudioFilePictures (params) {
  const file = params.file
  const metadata = {}
  try {
    const myFile = taglibSharp.File.createFromPath(file, '')
    if (myFile.tag.pictures && Array.isArray(myFile.tag.pictures)) {
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
  } catch (error) {
    if (error.message.startsWith('Unsupported format')) {
      // fail silently: this error happens when trying to open a file the app supports audio playback from but is a file format that taglib doesn't support, such as SPC files. in such cases, there is no need to extract images from the file because there aren't any to extract
    } else {
      console.error(`${error.message} in file ${file}`)
    }
  }

  return metadata
}

module.exports = getAudioFilePictures
