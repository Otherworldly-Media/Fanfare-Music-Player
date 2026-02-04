// various audio file management functionality
const { ipcMain } = require('electron')
const { Worker } = require('worker_threads')
const fs = require('fs')
const path = require('path')

// handle renderer sending files to the main process
ipcMain.handle('files-dropped', async (event, paths) => {
  await global.mainWindow.webContents.send('updateUI', { action: 'addDraggedFilesToLibrary', params: paths })
})

// handle importing a new audio file library
const getAudioFileMetadata = require('../models/getAudioFileMetadata')
const TAGLIB_ACCESSORS = require('../models/getTaglibAccessors')
ipcMain.handle('addFilesToLibrary', async (event, filesToAdd, chunk, filesAdded) => await addFilesToLibrary(filesToAdd, chunk, filesAdded))

async function addFilesToLibrary (filesToAdd, chunk, filesAdded) {
  return new Promise((resolve, reject) => {
    // accepts a string representing a dir or an array of strings representing either files or dirs
    let fileList = []
    if (typeof filesToAdd === 'object') {
      for (const file of filesToAdd) {
        if (fs.lstatSync(file).isDirectory()) {
          const thisList = fs.readdirSync(file, { recursive: true }).map(f => path.join(file, f)) // list of absolute paths
          fileList = fileList.concat(thisList)
        } else {
          fileList.push(file)
        }
      }
    } else {
      fileList = fs.readdirSync(filesToAdd, { recursive: true }).map(f => path.join(filesToAdd, f)) // list of absolute paths
    }

    chunk = chunk || 0
    filesAdded = filesAdded || []

    // process 1111 files at a time before reporting progress back to the renderer
    const chunkSize = 1111
    const chunks = []
    for (let i = 0; i < fileList.length; i += chunkSize) chunks.push(fileList.slice(i, i + chunkSize))

    // delegate file processing to a worker thread so the app doesn't freeze when importing thousands of files
    const worker = new Worker(path.join(__dirname, '../models/addFilesToLibrary.js'))
    worker.postMessage({ chunks, chunk })

    // when the worker is done
    worker.on('message', (newFiles) => {
      filesAdded.push(...newFiles)

      // when we're done processing every file
      if (chunk === chunks.length - 1) {
        if (filesAdded.length > 0) { // do nothing if no valid files were added
          let sql = 'insert into library (file_path, date_added'
          TAGLIB_ACCESSORS.forEach(key => {
            if (key !== 'pictures') {
              sql += `, ${key}`
            }
          })
          sql += ') values (?, ?'
          TAGLIB_ACCESSORS.forEach(key => {
            if (key !== 'pictures') {
              sql += ', ?'
            }
          })
          sql += ')'
          global.db.query(sql, filesAdded)
        }
        resolve({
          done: true,
          chunks,
          filesAdded
        })
      } else {
        resolve({
          done: false,
          chunks,
          filesAdded
        })
      }
      worker.terminate()
    })
  })
}

// handle open binary data calls from renderer
ipcMain.handle('getBinaryData', async (event, file) => {
  const fileBuffer = fs.readFileSync(file) // read the file as a buffer
  return fileBuffer // send the binary data to the renderer process
})

// handle open file metadata calls from renderer
ipcMain.handle('getAudioFileMetadata', async (event, params) => getAudioFileMetadata(params))

// convert file to FLAC and get audio data as a Buffer
const ffmpegStatic = require('ffmpeg-static')
const ffmpegPath = ffmpegStatic.includes('app.asar') ? ffmpegStatic.replace('app.asar', 'app.asar.unpacked') : ffmpegStatic // if running from asar, replace with unpacked path

const { spawn } = require('child_process')
const tmp = require('tmp')
ipcMain.handle('convertToFlacBuffer', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const tmpFile = tmp.tmpNameSync({ postfix: '.flac' })
    const ffmpeg = spawn(ffmpegPath, [
      '-i', filePath,
      '-f', 'flac',
      tmpFile
    ])

    ffmpeg.stderr.on('data', data => {
      // ffmpeg logs lots of non-error output to stderr unfortunately
      // const output = data.toString()
    })
    ffmpeg.on('error', reject)
    ffmpeg.on('close', code => {
      if (code === 0) {
        const buffer = fs.readFileSync(tmpFile)
        fs.unlinkSync(tmpFile)
        resolve(buffer)
      } else {
        fs.existsSync(tmpFile) && fs.unlinkSync(tmpFile)
        reject(new Error('unknown FFmpeg error'))
      }
    })
  })
})
