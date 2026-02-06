const electron = window.electron

module.exports = () => {
  if (window.playbackControlsInitialized) return
  window.playbackControlsInitialized = true

  window.audioContext = new window.AudioContext() // create a global audio context using web audio api
  window.gainNode = window.audioContext.createGain() // create a gain node for controlling volume
  window.gainNode.connect(window.audioContext.destination) // connect gain node to audio context for controlling volume
  window.fileCaches = {} // cache file data for gapless playback

  // helper function for creating a typical proxy
  function createProxy (arr, onChange) {
    return new Proxy(arr, {
      set (target, prop, value) {
        target[prop] = value
        onChange(target, prop, value)
        return true
      },
      deleteProperty (target, prop) {
        delete target[prop]
        onChange(target, prop, undefined)
        return true
      }
    })
  }

  // files the user has manually set to play next
  let manualPlayQueue = createProxy([], onManualPlayQueueChange)
  Object.defineProperty(window, 'manualPlayQueue', {
    get () {
      return manualPlayQueue
    },
    set (newArr) {
      manualPlayQueue = createProxy([...newArr], onManualPlayQueueChange)
      onManualPlayQueueChange(manualPlayQueue, 'replace', newArr)
    }
  })
  function onManualPlayQueueChange (target, prop, value) {
    if (!window.onManualPlayQueueChangeDebounce) {
      window.onManualPlayQueueChangeDebounce = true
      window.setTimeout(() => {
        updateQueue('manualPlayQueue')
        window.onManualPlayQueueChangeDebounce = false
      }, 1000)
    }
  }

  // files the app has automatically determined to play next
  let automaticPlayQueue = createProxy([], onAutomaticPlayQueueChange)
  Object.defineProperty(window, 'automaticPlayQueue', {
    get () {
      return automaticPlayQueue
    },
    set (newArr) {
      automaticPlayQueue = createProxy([...newArr], onAutomaticPlayQueueChange)
      onAutomaticPlayQueueChange(automaticPlayQueue, 'replace', newArr)
    }
  })
  function onAutomaticPlayQueueChange (target, prop, value) {
    if (!window.onAutomaticPlayQueueChangeDebounce) {
      window.onAutomaticPlayQueueChangeDebounce = true
      window.setTimeout(() => {
        updateQueue('automaticPlayQueue')
        window.onAutomaticPlayQueueChangeDebounce = false
      }, 1000)
    }
  }
  window.maxFilesInAutomaticQueue = 43 // maximum number of files allowed in the automatic queue

  // play history
  let playHistory = createProxy([], onPlayHistoryChange)
  Object.defineProperty(window, 'playHistory', {
    get () {
      return playHistory
    },
    set (newArr) {
      playHistory = createProxy([...newArr], onPlayHistoryChange)
      onPlayHistoryChange(playHistory, 'replace', newArr)
    }
  })
  function onPlayHistoryChange (target, prop, value) {
    if (!window.onPlayHistoryChangeDebounce) {
      window.onPlayHistoryChangeDebounce = true
      window.setTimeout(() => {
        updateQueue('playHistory')
        window.onPlayHistoryChangeDebounce = false
      }, 1000)
    }
  }

  // handle button presses on the media controls
  document.querySelector('#shuffleButton').addEventListener('click', toggleShuffle)
  document.querySelector('#previousButton').addEventListener('click', previousFile)
  document.querySelector('#playPauseButton').addEventListener('click', playPause)
  document.querySelector('#nextButton').addEventListener('click', nextFile)
  document.querySelector('#repeatButton').addEventListener('click', toggleRepeat)
  document.querySelector('#playbackSpeedButton').addEventListener('click', async (event) => {
    event.preventDefault()
    if (typeof window.table !== 'undefined') {
      let playbackSpeed = window.currentSource?.playbackRate?.value
      if (!playbackSpeed) playbackSpeed = electron.store.get('playbackSpeed')
      if (!playbackSpeed) playbackSpeed = 1
      window.alertDialog(
        {
          html: `
            <p>Playback speed: <output id="playbackSpeed">${playbackSpeed}</output></p>
            <p><input type="range" id="playbackSpeedSlider" min="0.25" max="8" step="0.25" value="${playbackSpeed}"></p>
          `,
          buttons: {
            reset: true
          }
        }
      )
      document.getElementById('playbackSpeedSlider').addEventListener('input', updatePlaybackSpeedSlider)
      function updatePlaybackSpeedSlider () {
        const playbackSpeed = document.getElementById('playbackSpeedSlider').value
        electron.store.set('playbackSpeed', playbackSpeed)
        window.userStoppedPlayback = true
        seekPlayback()
        window.userStoppedPlayback = false
        queueAudio(window.currentFile, window.pausedAt, true)
        document.getElementById('playbackSpeed').innerHTML = playbackSpeed
      }
      document.querySelector('dialog[open] button[type="reset"').addEventListener('click', () => {
        document.getElementById('playbackSpeedSlider').value = 1
        updatePlaybackSpeedSlider()
      })
    }
  })

  // handle seek events
  document.getElementById('seekBar').addEventListener('input', () => {
    const audioBuffer = window.fileCaches[window.currentFile].audioBuffer
    const seekPosition = (document.getElementById('seekBar').value / 100) * audioBuffer.duration
    window.userStoppedPlayback = true
    seekPlayback()
    window.userStoppedPlayback = false
    queueAudio(window.currentFile, seekPosition, true)
  })

  // handle volume adjustment events
  document.getElementById('muteButton').addEventListener('click', () => {
    window.gainNode.gain.value = 0
    document.getElementById('volumeBar').value = 0
    electron.store.set('volume', document.getElementById('volumeBar').value)
  })
  document.getElementById('volumeBar').addEventListener('input', () => {
    window.gainNode.gain.value = document.getElementById('volumeBar').value / 100 // set initial volume
    electron.store.set('volume', document.getElementById('volumeBar').value)
  })
  document.getElementById('maxVolumeButton').addEventListener('click', () => {
    window.gainNode.gain.value = 1
    document.getElementById('volumeBar').value = 100
    electron.store.set('volume', document.getElementById('volumeBar').value)
  })

  // apply settings
  document.getElementById('volumeBar').value = electron.store.get('volume') || 100
  window.gainNode.gain.value = document.getElementById('volumeBar').value / 100 // set initial volume
}

async function playPause () {
  if (!window.currentFile) { // not currently playing anything
    // play first file in the queue if it exists
    if (window.manualPlayQueue[0]) return window.playAudioFile(window.manualPlayQueue[0], 'playPause')
    if (window.automaticPlayQueue[0]) return window.playAudioFile(window.automaticPlayQueue[0], 'playPause')

    // play first row visible on the table
    const firstRow = window.table.getRows('active')[0]
    if (firstRow) return window.playAudioFile(firstRow.getData().file_path, 'playPause')
    else return // no rows are visible on the table, so do nothing
  }

  // there is a current file selected
  if (window.playing) {
    // pause current playback
    window.userStoppedPlayback = true
    stopPlayback()
    document.querySelector('#playPauseButton input').src = 'renderer://images/play.svg'
    document.querySelector('#playPauseButton').title = 'Play'
    window.table.updateData([{ file_path: window.currentFile, playback_image: 'volume-off' }])
  } else {
    // resume playback
    window.userStoppedPlayback = false
    await queueAudio(window.currentFile, window.pausedAt)
    document.querySelector('#playPauseButton input').src = 'renderer://images/pause.svg'
    document.querySelector('#playPauseButton').title = 'Pause'
    window.table.updateData([{ file_path: window.currentFile, playback_image: 'volume-up' }])
  }

  document.getElementById('seekBar').disabled = false
}

function seekPlayback () {
  if (window.currentSource) {
    try { window.currentSource.stop() } catch (e) {}
    window.pausedAt = window.audioContext.currentTime - window.playbackStartTime
    window.currentSource.disconnect()
    window.currentSource = null
  }
}

function stopPlayback () {
  if (window.currentSource) {
    try { window.currentSource.stop() } catch (e) {}
    window.pausedAt = window.audioContext.currentTime - window.playbackStartTime
    window.currentSource.disconnect()
    window.currentSource = null
    window.playing = false
  }

  // stop and disconnect the next scheduled source if present
  if (window.scheduledNextSource) {
    try { window.scheduledNextSource.stop() } catch (e) {}
    window.scheduledNextSource.disconnect()
    window.scheduledNextSource = null
  }
}
window.stopPlayback = stopPlayback

// called when the user requests a specific audio file to be played
window.playAudioFile = async function (file, via, gapless) {
  if (!gapless) {
    document.getElementById('seekBar').disabled = false
    document.getElementById('seekBar').value = 0
    stopPlayback()
  }

  window.userPressedPlay = true
  window.userStoppedPlayback = false

  clearPlayQueueImages()

  window.previousFile = window.currentFile
  window.currentFile = file

  if (via !== 'history') {
    // add old file to history
    if (window.previousFile) window.playHistory.push(window.previousFile)

    // if the file was selected via the play queue, remove it from the queue and adjust the queue accordingly
    if (via === 'manualPlayQueue') window.manualPlayQueue.splice(window.manualPlayQueue.indexOf(file), 1)
    else if (via === 'automaticPlayQueue' || window.repeat) window.automaticPlayQueue.splice(window.automaticPlayQueue.indexOf(file), 1)
    else if (via === 'playPause') {
      if (window.manualPlayQueue[0]) window.manualPlayQueue.splice(window.manualPlayQueue.indexOf(file), 1)
      else if (window.automaticPlayQueue[0]) window.automaticPlayQueue.splice(window.automaticPlayQueue.indexOf(file), 1)
    } else if (via === 'selectFile' || !via) {
      // if the file was selected from the file list directly, create a new automatic queue, but don't modify the manual queue
      window.automaticPlayQueue = []
      window.automaticPlayQueueCurrentTable = null
      addNextFilesToAutomaticPlayQueue()
    }
  }

  if (!gapless) await loadFile(file)
  else file = await preloadNextFile()
  queueAudio(file)
}

// loads the binary data for the file into memory
async function loadFile (file) {
  // prevent attempting to load a nonexistent file
  if (!file) return

  // prevent attempting to load the file while it is already being loaded; this prevents lag while seeking
  async function waitForFileToFinishLoading (file) {
    while (window.loadingFile === file) await new Promise(resolve => setTimeout(resolve, 50)) // check every 50ms
  }
  if (window.loadingFile === file) return await waitForFileToFinishLoading(file)

  // skip file preload if it's already preloaded
  if (window.fileCaches[file]?.audioBuffer) return

  // start loading
  window.loadingFile = file
  if (!window.playing && window.userPressedPlay) document.documentElement.classList.add('global-wait')
  let pcmBuffer // var to store raw PCM audio data
  let audioBuffer // var to store audio binary in the Web Audio API's format

  // special handler for SPC files
  if (file.endsWith('.spc')) {
    // get SPC binary data from the main process
    const rawAudioData = await window.electron.getBinaryData(file)
    const rawArrayBuffer = new Uint8Array(rawAudioData.buffer)

    // convert the SPC file to PCM audio
    const SPCPlayer = await require('ui/loadSpcPlayer')()
    pcmBuffer = await SPCPlayer.renderToPCMBuffer(rawArrayBuffer)
  }

  // load PCM data into the Web Audio API
  try {
    // if we don't already have the PCM data, get PCM data from FFmpeg from the main process
    if (!pcmBuffer) {
      // we get the data in chunks via ipc so the UI doesn't freeze
      const pcmChunks = []
      await new Promise((resolve, reject) => {
        const listenerEvent = window.electron.onConvertToPCMAudioChunk((chunk) => {
          pcmChunks.push(new Uint8Array(chunk))
        })
        window.electron.onConvertToPCMAudioComplete(() => {
          window.electron.offConvertToPCMAudioChunk(listenerEvent) // remove listener so listeners don't pile up in the renderer process creating a memory leak
          resolve()
        })
        window.electron.convertToPCMAudio(file).catch(reject)
      })

      // reassemble the chunks into pcm binary
      const totalLength = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      pcmBuffer = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of pcmChunks) {
        pcmBuffer.set(chunk, offset)
        offset += chunk.length
      }
    }

    // convert the pcm binary into a Web Audio API buffer
    const float32Data = new Float32Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      Math.floor(pcmBuffer.byteLength / 4)
    )
    const numberOfChannels = 2
    const sampleRate = 48000
    const numberOfSamples = Math.floor(float32Data.length / numberOfChannels)
    audioBuffer = window.audioContext.createBuffer(numberOfChannels, numberOfSamples, sampleRate)

    // de-interleave channels: FFmpeg and SPCPlayer output PCM data in interleaved format (all channels mixed together), but the Web Audio API's AudioBuffer expects planar format (separate arrays per channel)
    // we will de-interleave in chunks and yield to the event loop to keep the UI responsive
    const chunkSize = 100000 // process 100k samples at a time
    let channelOffset = 0
    await new Promise((resolve) => {
      const processChunk = () => {
        const chunkEnd = Math.min(channelOffset + chunkSize, numberOfSamples)
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel)
          for (let i = channelOffset; i < chunkEnd; i++) {
            channelData[i] = float32Data[i * numberOfChannels + channel] // extract every Nth sample for this channel
          }
        }
        channelOffset = chunkEnd
        if (channelOffset < numberOfSamples) setTimeout(processChunk, 0) // yield to event loop to keep the UI responsive
        else resolve()
      }
      processChunk()
    })
  } catch (error) {
    console.error(error)
    window.loadingFile = false
    return window.alertDialog({ html: '<p>There was an unknown error trying to play the file.</p>' })
  }

  // cache audio buffer for later reuse
  if (!window.fileCaches[file]) {
    window.fileCaches[file] = {
      cacheTime: Date.now()
    }
  }
  window.fileCaches[file].audioBuffer = audioBuffer // cache the audioBuffer

  // get media metadata
  if (!window.fileCaches[file]) window.fileCaches[file] = {}
  if (!window.fileCaches[file].metadata) {
    if (file.endsWith('.spc')) {
      window.fileCaches[file].metadata = await window.electron.getAudioFileMetadata({
        file,
        specialType: 'spc'
      })
    } else {
      window.fileCaches[file].metadata = await window.electron.getAudioFileMetadata({ file })
    }

    // load pictures separately via chunked ipc
    const pictureChunks = []
    await window.electron.getAudioFilePictures(
      { file },
      (chunk) => {
        pictureChunks.push(chunk)
      },
      () => {
        const json = pictureChunks.join('')
        const picturesPayload = JSON.parse(json)
        window.fileCaches[file].metadata.pictures = picturesPayload.pictures || []
        if (file === window.currentFile) {
          updateAlbumArt()
        }
        updateQueue('manualPlayQueue')
        updateQueue('automaticPlayQueue')
      }
    )
  }

  window.loadingFile = false
}

// play an audio file or queue it to be played after the current audio file is done
async function queueAudio (file, offset = 0, seek = false) {
  if (!file) return
  if (window.userStoppedPlayback) return
  const audioBuffer = window.fileCaches[file].audioBuffer
  const source = window.audioContext.createBufferSource()
  source.buffer = audioBuffer
  source._id = Date.now() + Math.random() // unique id for this source
  const playbackSpeed = Number(electron.store.get('playbackSpeed')) || 1
  source.playbackRate.value = playbackSpeed
  source.connect(window.gainNode)
  source.onended = onFilePlaybackEnd

  if (!window.playing || seek) {
    if (window.fileCaches[window.currentFile]) {
      source.start(0, offset)
      window.playing = true
      window.userPressedPlay = false
      document.documentElement.classList.remove('global-wait')
      window.fileCaches[window.currentFile].source = source
      window.currentSource = source
      window.currentSourceId = source._id
      window.playbackStartTime = window.audioContext.currentTime - offset

      if (!window.playingInterval) {
        function updateSeekBar () {
          if (window.playing) {
            window.playingFileElapsedTime = window.audioContext.currentTime - window.playbackStartTime
            document.getElementById('currentTime').textContent = formatTime(window.playingFileElapsedTime)
            document.getElementById('seekBar').value = (window.playingFileElapsedTime / window.fileCaches[window.currentFile].audioBuffer.duration) * 100
          }
        }
        updateSeekBar()
        window.playingInterval = window.setInterval(updateSeekBar, 1000)
      }

      document.querySelector('#playPauseButton input').src = 'renderer://images/pause.svg'
      document.querySelector('#playPauseButton').title = 'Pause'
      displayMetadata()
      addNextFilesToAutomaticPlayQueue()
    }

    file = await preloadNextFile()
    await queueAudio(file)
    scheduleNextSource()
  } else {
    scheduleNextSource()
  }
}

function onFilePlaybackEnd () {
  const source = this
  if (source._id === window.currentSourceId && !window.userStoppedPlayback) {
    if (window.currentSource) {
      window.currentSource.stop()
      window.currentSource.disconnect()
      window.currentSource = window.fileCaches[window.nextFile]?.source || null
      window.currentSourceId = window.currentSource?._id
      window.playbackStartTime = window.nextStartTime
      window.scheduledNextSource = null
      nextFile(true)
      displayMetadata()
      if (window.nextFile) addNextFilesToAutomaticPlayQueue()
      else setPlayQueueImages()
    }
  }
}

function scheduleNextSource () {
  const nextFile = window.nextFile
  if (!nextFile || !window.fileCaches[nextFile]?.audioBuffer) return

  // stop and disconnect any previously scheduled next source
  if (window.scheduledNextSource) {
    try { window.scheduledNextSource.stop() } catch (e) {}
    window.scheduledNextSource.disconnect()
    window.scheduledNextSource = null
  }

  // schedule next track to start exactly after the current one
  const now = window.audioContext.currentTime
  const offset = 0
  const timeLeft = window.fileCaches[window.currentFile].audioBuffer.duration - (now - window.playbackStartTime + offset)
  const startTime = now + timeLeft
  const nextSource = window.audioContext.createBufferSource()
  nextSource.buffer = window.fileCaches[nextFile].audioBuffer
  nextSource.playbackRate.value = Number(electron.store.get('playbackSpeed')) || 1
  nextSource.connect(window.gainNode)
  nextSource.onended = onFilePlaybackEnd
  nextSource.start(startTime)
  window.fileCaches[nextFile].source = nextSource
  window.nextStartTime = startTime
  window.scheduledNextSource = nextSource
  window.debounceScheduleNextSource = true
}

async function preloadNextFile () {
  let nextFile
  if (window.repeat === 'file') nextFile = window.currentFile // the current file is repeating
  else if (window.manualPlayQueue[0]) nextFile = window.manualPlayQueue[0] // play next file in the manual queue if any exist
  else if (window.automaticPlayQueue[0]) nextFile = window.automaticPlayQueue[0] // play next file in the automatic queue if any exist
  window.nextFile = nextFile
  await loadFile(nextFile)
  return nextFile
}

async function updateQueue (which) {
  if (window[which].length <= 0) {
    document.getElementById(which).parentNode.querySelector('p.noneInQueue').style.display = 'block'
    document.getElementById(which).innerHTML = ''
    return
  } else {
    document.getElementById(which).parentNode.querySelector('p.noneInQueue').style.display = 'none'
  }
  let listLabel = `<p class="listLabel"><span class="playingNext">Playing Next</span> <span class="halfTranslucent">from</span> <strong>${window.currentPlaylist || 'Library'}</strong></p>`
  if (which === 'playHistory') listLabel = '<p class="listLabel"><span class="previouslyPlayed">Previously Played</span></p>'
  let items = `
      <li>
        <div class="metadata">
          ${listLabel}
          <form class="clearButton semanticForms noSubmit">
            <button value="${which}">Clear</button>
          </form>
        </div>
      </li>
    `
  for (const file of window[which]) {
    const domId = window.btoa(file)
    items += `
        <li data-id="${domId}">
          <hr>
          <div class="metadata">
            <div class="artwork"></div>
            <div class="info">
              <div class="performer">
                <p class="fileTitle">…</p>
                <p class="artistInfo"><span class="artist">…</span> <span class="emdash">…</span> <span class="album">…</span></p>
              </div>
            </div>
            <div class="durationContainer">
              <p class="duration">…</p>
            </div>
          </div>
        </li>
      `
  }
  document.getElementById(which).innerHTML = items
  document.getElementById(which).querySelector('.clearButton').addEventListener('submit', (event) => {
    event.preventDefault()
    const which = event.target.querySelector('button').value
    clearPlayQueueImages()
    window[which] = []
    document.getElementById(which).innerHTML = ''
    setPlayQueueImages()
  })
  for (const file of window[which]) {
    const domId = window.btoa(file)
    await loadFile(file)
    const domEls = document.querySelectorAll(`li[data-id="${domId}"]`)
    for (const domEl of domEls) {
      domEl.querySelector('.duration').textContent = formatTime(window.fileCaches[file].audioBuffer.duration)
      let artworkMimeType
      let artworkDataUri
      if (window.fileCaches[file].metadata) {
        const performers = window.fileCaches[file].metadata.performers
        if (performers) domEl.querySelector('.artist').innerHTML = performers.join(' / ')
        else domEl.querySelector('.artist').innerHTML = '[unknown artist]'
        const album = window.fileCaches[file].metadata.album
        if (album) {
          domEl.querySelector('.emdash').innerHTML = ' — '
          domEl.querySelector('.album').innerHTML = window.fileCaches[file].metadata.album
        } else {
          domEl.querySelector('.emdash').innerHTML = ''
          domEl.querySelector('.album').innerHTML = ''
        }
        domEl.querySelector('.fileTitle').innerHTML = window.fileCaches[file].metadata.title || '[untitled]'

        // set artwork
        const defaultMimeType = 'image/png'
        const defaultDataUri = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAADUlEQVR42gECAP3/AAAAAgABUyucMAAAAABJRU5ErkJggg==' // 1 black pixel
        if (window.fileCaches[file].metadata.pictures) {
          artworkMimeType = window.fileCaches[file].metadata.pictures[0]?.mimeType || defaultMimeType
          artworkDataUri = window.fileCaches[file].metadata.pictures[0]?.data || defaultDataUri
        } else {
          artworkMimeType = defaultMimeType
          artworkDataUri = defaultDataUri
        }
      }

      // animate artwork transition
      if (domEl.querySelector('.artwork').style.backgroundImage !== `url("data:${artworkMimeType};base64,${artworkDataUri}")`) { // do not trigger the transition if the artwork has not changed
        // the view transition is commented out because it blocks clicking around the play queue area for a full second; see https://github.com/Otherworldly-Media/Fanfare-Music-Player/issues/86
        // document.startViewTransition(() => {
        domEl.querySelector('.artwork').style.backgroundImage = `url("data:${artworkMimeType};base64,${artworkDataUri}")`
        // })
      }
    }
  }

  // purge automatic and manual play queues of any files that have been cached for some time and are no longer in the queue
  const now = Date.now()
  for (const file in window.fileCaches) {
    const isInManualQueue = window.manualPlayQueue.includes(file)
    const isInAutomaticQueue = window.automaticPlayQueue.includes(file)
    const isOlderThanHour = now - window.fileCaches[file].cacheTime > 60 * 60 * 1000
    if (!isInManualQueue && !isInAutomaticQueue && isOlderThanHour && window.currentFile !== file) {
      delete window.fileCaches[file]
    }
  }
}

function displayMetadata () {
  if (window.fileCaches[window.currentFile]) {
    document.getElementById('duration').textContent = formatTime(window.fileCaches[window.currentFile].audioBuffer.duration)
    if (window.fileCaches[window.currentFile].metadata) {
      document.getElementById('file').classList.remove('musicIcon')
      const performers = window.fileCaches[window.currentFile].metadata.performers
      if (performers) document.getElementById('artist').innerHTML = performers.join(' / ')
      else document.getElementById('artist').innerHTML = '[unknown artist]'
      const album = window.fileCaches[window.currentFile].metadata.album
      if (album) {
        document.getElementById('emdash').innerHTML = ' — '
        document.getElementById('album').innerHTML = window.fileCaches[window.currentFile].metadata.album
      } else {
        document.getElementById('emdash').innerHTML = ''
        document.getElementById('album').innerHTML = ''
      }
      document.getElementById('fileTitle').innerHTML = window.fileCaches[window.currentFile].metadata.title || '[untitled]'
    }
  }
  updateAlbumArt()
  window.addTitleToEllipsisOnPlaybackMetadata()
}
window.displayMetadata = displayMetadata

function updateAlbumArt () {
  const fileCache = window.fileCaches[window.currentFile]

  // set artwork
  const defaultMimeType = 'image/png'
  const defaultDataUri = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAADUlEQVR42gECAP3/AAAAAgABUyucMAAAAABJRU5ErkJggg==' // 1 black pixel
  let artworkMimeType
  let artworkDataUri
  if (fileCache && window.fileCaches[window.currentFile].metadata.pictures) {
    artworkMimeType = window.fileCaches[window.currentFile].metadata.pictures[0]?.mimeType || defaultMimeType
    artworkDataUri = window.fileCaches[window.currentFile].metadata.pictures[0]?.data || defaultDataUri
  } else {
    artworkMimeType = defaultMimeType
    artworkDataUri = defaultDataUri
  }

  // animate artwork transition
  if (document.getElementById('artwork').style.backgroundImage !== `url("data:${artworkMimeType};base64,${artworkDataUri}")`) { // do not trigger the transition if the artwork has not changed
    document.getElementById('artwork').style.viewTransitionName = 'artwork-transition' // apply and remove view transition only for this action; don't leave it applied in css permanently; this is to prevent it from triggering with repaints and reflows
    // the view transition is commented out because it blocks clicking around the play queue area for a full second; see https://github.com/Otherworldly-Media/Fanfare-Music-Player/issues/86
    // document.startViewTransition(() => {
    document.getElementById('artwork').style.backgroundImage = `url("data:${artworkMimeType};base64,${artworkDataUri}")`
    // })
    setTimeout(() => {
      document.getElementById('artwork').style.viewTransitionName = ''
    }, 1000)
  }

  window.addTitleToEllipsisOnPlaybackMetadata()
}

// format time in minutes:seconds
function formatTime (seconds) {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${secs}`
}

function toggleShuffle () {
  clearPlayQueueImages()
  if (window.shuffle) {
    // deactivate shuffle
    window.shuffle = false
    document.querySelector('#shuffleButton g').setAttribute('fill', '#000')
    document.querySelector('#shuffleButton g').setAttribute('stroke', '#000')
    document.querySelector('#shuffleButton').classList.remove('active')

    // replace automatic queue with whatever the next files are after the currently playing one
    if (window.currentFile) {
      // get the files that are after the currently playing file
      const rows = window.table.getRows('active')
      const currentIndex = rows.findIndex(row => row.getData().file_path === window.currentFile)
      const rowsAfterCurrent = rows.slice(currentIndex + 1).map(row => row.getData().file_path)
      window.automaticPlayQueue = [...rowsAfterCurrent]

      // trim list to window.maxFilesInAutomaticQueue
      window.automaticPlayQueue.splice(window.maxFilesInAutomaticQueue)
    } else { // no file is currently playing, so replace the automatic queue with whatever the beginning of the current view is
      // get the list of files in the current view
      const rows = window.table.getRows('active')
      const filePaths = rows.map(row => row.getData().file_path)
      window.automaticPlayQueue = [...filePaths]

      // trim list to window.maxFilesInAutomaticQueue
      window.automaticPlayQueue.splice(window.maxFilesInAutomaticQueue)
    }
  } else {
    // shuffle
    window.shuffle = true
    document.querySelector('#shuffleButton g').setAttribute('fill', window.accentColor)
    document.querySelector('#shuffleButton g').setAttribute('stroke', window.accentColor)
    document.querySelector('#shuffleButton').classList.add('active')

    // replace automatic queue with a list of random files from the current filter
    const rows = window.table.getRows('active')
    const filePaths = rows.map(row => row.getData().file_path)
    window.automaticPlayQueue = [...filePaths]

    // remove current file from the array to shuffle
    const idx = window.automaticPlayQueue.indexOf(window.currentFile)
    if (idx !== -1) window.automaticPlayQueue.splice(idx, 1)

    // randomize the array
    window.automaticPlayQueue = shuffleArray(window.automaticPlayQueue)

    // trim list to window.maxFilesInAutomaticQueue
    window.automaticPlayQueue.splice(window.maxFilesInAutomaticQueue)
  }
  setPlayQueueImages()
}

// implementation of fisher–yates algorithm for shuffle https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
function shuffleArray (array) {
  let currentIndex = array.length

  // while there remain elements to shuffle...
  while (currentIndex !== 0) {
    // pick a remaining element...
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // and swap it with the current element
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }

  return array
}

function toggleRepeat () {
  clearPlayQueueImages()
  if (!window.repeat) {
    window.repeat = 'set'
    document.querySelector('#repeatButton svg.repeat').style.display = 'inline'
    document.querySelector('#repeatButton svg.repeat-1').style.display = 'none'
    document.querySelector('#repeatButton svg.repeat').setAttribute('fill', window.accentColor)
    document.querySelector('#repeatButton').classList.add('active')

    // take snapshot of automatic queue
    if (window.currentFile) window.automaticPlayQueueSnapshot = [window.currentFile, ...window.automaticPlayQueue]
    else { // there is no automatic queue
      // use currently visible files in the table if there is no automatic queue yet
      const rows = window.table.getRows('active').slice(0, window.maxFilesInAutomaticQueue)
      const filePaths = rows.map(row => row.getData().file_path)
      window.automaticPlayQueueSnapshot = [...filePaths]
    }

    // repeat set repeats whatever is in the play queue
    addNextFilesToAutomaticPlayQueue()
  } else if (window.repeat === 'set') {
    window.repeat = 'file'
    document.querySelector('#repeatButton svg.repeat').style.display = 'none'
    document.querySelector('#repeatButton svg.repeat-1').style.display = 'inline'
    document.querySelector('#repeatButton svg.repeat-1').setAttribute('fill', window.accentColor)
    document.querySelector('#repeatButton').classList.add('active')

    // clear automatic play queue from previous set
    addNextFilesToAutomaticPlayQueue()
  } else if (window.repeat === 'file') {
    window.repeat = null
    document.querySelector('#repeatButton svg.repeat').style.display = 'inline'
    document.querySelector('#repeatButton svg.repeat-1').style.display = 'none'
    document.querySelector('#repeatButton svg.repeat').setAttribute('fill', '#000')
    document.querySelector('#repeatButton').classList.remove('active')
    window.automaticPlayQueue = []
    addNextFilesToAutomaticPlayQueue()
  }
  setPlayQueueImages()
}

function previousFile () {
  // if seek position is less than 3 seconds and there is history to go back to, then go back to the previous file
  if (window.playingFileElapsedTime < 3 && window.playHistory.length > 0) {
    clearPlayQueueImages()
    const previousFile = window.playHistory.pop()
    // add the current file back to the play queue
    if (window.manualPlayQueue.length > 0) {
      window.manualPlayQueue.unshift(window.currentFile)
      window.manualPlayQueue.pop()
    } else {
      window.automaticPlayQueue.unshift(window.currentFile)
      window.automaticPlayQueue.pop()
    }
    window.playAudioFile(previousFile, 'history')
    setPlayQueueImages()
  } else {
    // seek to the beginning of the file
    window.userStoppedPlayback = true
    stopPlayback()
    window.userStoppedPlayback = false
    queueAudio(window.currentFile, 0, true)
  }
}

function nextFile (gapless) {
  if (typeof gapless !== 'boolean') gapless = false // don't send pointer events or other nonsense down the stack
  if (window.repeat === 'file') window.playAudioFile(window.currentFile, 'repeatFile', gapless) // the current file is repeating
  else if (window.manualPlayQueue[0]) window.playAudioFile(window.manualPlayQueue[0], 'manualPlayQueue', gapless) // play next file in the manual queue if any exist
  else if (window.automaticPlayQueue[0]) window.playAudioFile(window.automaticPlayQueue[0], 'automaticPlayQueue', gapless) // play next file in the automatic queue if any exist
  else resetPlaybackControls()
}

function resetPlaybackControls () {
  document.querySelector('#playPauseButton input').src = 'renderer://images/play.svg'
  document.querySelector('#playPauseButton').title = 'Play'
  document.getElementById('seekBar').value = 0
  document.getElementById('seekBar').disabled = true
  document.getElementById('currentTime').textContent = '0:00'
  document.getElementById('duration').textContent = formatTime(0)
  document.getElementById('file').classList.add('musicIcon')
  document.getElementById('artist').innerHTML = '&nbsp;'
  document.getElementById('emdash').innerHTML = '&nbsp;'
  document.getElementById('album').innerHTML = '&nbsp;'
  document.getElementById('fileTitle').innerHTML = '&nbsp;'
  window.playing = false
  clearPlayQueueImages()
  window.currentFile = null
  updateQueue('automaticPlayQueue')
}
window.resetPlaybackControls = resetPlaybackControls

function addNextFilesToAutomaticPlayQueue () {
  if (window.repeat === 'set') {
    const filesToAdd = window.maxFilesInAutomaticQueue - window.automaticPlayQueue.length
    const lastFileInQueue = window.automaticPlayQueue[window.automaticPlayQueue.length - 1]
    const lastFileSnapshotIndex = window.automaticPlayQueueSnapshot.indexOf(lastFileInQueue)
    const snapshotLastIndex = window.automaticPlayQueueSnapshot.length - 1
    let snapshotIndex = lastFileSnapshotIndex + 1
    if (!lastFileInQueue) snapshotIndex = 0
    for (let i = 0; i < filesToAdd; i++) {
      if (snapshotIndex > snapshotLastIndex) snapshotIndex = 0
      const nextFile = window.automaticPlayQueueSnapshot[snapshotIndex]
      window.automaticPlayQueue.push(nextFile)
      snapshotIndex++
    }
  } else if (window.repeat === 'file') {
    window.automaticPlayQueue = []
    const filesToAdd = window.maxFilesInAutomaticQueue
    for (let i = 0; i < filesToAdd; i++) {
      window.automaticPlayQueue.push(window.currentFile)
    }
  } else {
    const rows = window.automaticPlayQueueCurrentTable || window.table.getRows('active') // get visible, sorted, filtered rows
    window.automaticPlayQueueCurrentTable = [...rows]

    // get current file index
    let currentFileIndex
    for (currentFileIndex = 0; currentFileIndex < rows.length; currentFileIndex++) {
      const rowData = rows[currentFileIndex].getData()
      if (rowData.file_path === window.currentFile) break
    }

    // queue is empty; add n files to queue where n = filesToQueue
    if (window.automaticPlayQueue.length < 1) {
      const lastIndex = currentFileIndex + window.maxFilesInAutomaticQueue
      for (let i = currentFileIndex; i < lastIndex; i++) {
        const nextRow = rows[i + 1]
        if (nextRow) {
          const nextFilePath = nextRow.getData().file_path
          window.automaticPlayQueue.push(nextFilePath)
        }
      }
    } else {
      // there is already a queue, so just add to it
      const howManyToAdd = window.maxFilesInAutomaticQueue - window.automaticPlayQueue.length // will often be 1 because a file just ended so we need to add 1 more to the queue

      if (window.shuffle) {
        // add random files
        const activeRows = shuffleArray(window.table.getRows('active'))
        for (const row of activeRows) {
          const file = row.getData().file_path
          const inQueue = window.automaticPlayQueue.indexOf(file) !== -1
          if (!inQueue) {
            window.automaticPlayQueue.push(file)
            if (window.automaticPlayQueue.length === window.maxFilesInAutomaticQueue) break
          }
        }
      } else {
        // add files that come after the last file in the queue
        const lastItem = window.automaticPlayQueue[window.automaticPlayQueue.length - 1]
        let lastFileIndex
        for (lastFileIndex = currentFileIndex; lastFileIndex < rows.length; lastFileIndex++) {
          const rowData = rows[lastFileIndex].getData()
          if (rowData.file_path === lastItem) break
        }

        const nextIndex = lastFileIndex + howManyToAdd
        for (let i = lastFileIndex; i < nextIndex; i++) {
          const nextRow = rows[i + 1]
          if (nextRow) {
            const nextFilePath = nextRow.getData().file_path
            window.automaticPlayQueue.push(nextFilePath)
          }
        }
      }
    }
  }
  setPlayQueueImages()
}

function clearPlayQueueImages () {
  if (window.currentFile) window.table.updateData([{ file_path: window.currentFile, playback_image: null }])
  for (const file of window.manualPlayQueue) if (window.currentFile !== file) window.table.updateData([{ file_path: file, playback_image: null }])
  for (const file of window.automaticPlayQueue) if (window.currentFile !== file) window.table.updateData([{ file_path: file, playback_image: null }])
}

function setPlayQueueImages () {
  for (const file of window.manualPlayQueue) if (window.currentFile !== file) window.table.updateData([{ file_path: file, playback_image: 'play-queue' }])
  for (const file of window.automaticPlayQueue) if (window.currentFile !== file) window.table.updateData([{ file_path: file, playback_image: 'play-queue' }])
  if (window.currentFile) {
    if (document.querySelector('#playPauseButton').title === 'Play') window.table.updateData([{ file_path: window.currentFile, playback_image: 'volume-off' }])
    else window.table.updateData([{ file_path: window.currentFile, playback_image: 'volume-up' }])
  }
}

// hotkey support
window.addEventListener('keydown', (event) => {
  // ignore if focus is on an input, textarea, or contenteditable element
  const tag = event.target.tagName
  const isEditable = event.target.isContentEditable

  // prevent the below keys from being handled while typing
  if (
    (tag === 'INPUT' && event.target.type !== 'range') ||
    tag === 'TEXTAREA' ||
    isEditable
  ) return

  if (event.code === 'Space') {
    event.preventDefault()
    return playPause()
  } else if (event.code === 'Enter') {
    event.preventDefault()
    // get currently highlighted file and play it
    const selectedRows = window.table.getSelectedData()
    if (selectedRows.length > 0) window.playAudioFile(selectedRows[0].file_path, 'selectFile')
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault()
    previousFile()
  } else if (event.code === 'ArrowRight') {
    event.preventDefault()
    nextFile()
  }

  // get all visible rows in current sort/filter order
  if (window.table) {
    const rows = window.table.getRows('active')
    if (!rows.length) return

    // get currently selected row index
    const selectedRows = window.table.getSelectedRows()
    let currentIndex = -1
    if (selectedRows.length > 0) {
      const selectedRow = selectedRows[0]
      currentIndex = rows.findIndex(row => row === selectedRow)
    }

    if (event.code === 'ArrowDown') {
      event.preventDefault()
      let nextIndex = currentIndex + 1
      if (nextIndex >= rows.length) nextIndex = rows.length - 1
      if (nextIndex >= 0 && nextIndex < rows.length) {
        window.table.deselectRow()
        rows[nextIndex].select()
        rows[nextIndex].getElement().scrollIntoView({ block: 'nearest' })
      }
    } else if (event.code === 'ArrowUp') {
      event.preventDefault()
      let prevIndex = currentIndex - 1
      if (prevIndex < 0) prevIndex = 0
      if (prevIndex >= 0 && prevIndex < rows.length) {
        window.table.deselectRow()
        rows[prevIndex].select()
        rows[prevIndex].getElement().scrollIntoView({ block: 'nearest' })
      }
    }
  }
})

// handle media keys
electron.listen('mediaPlayPause', playPause)
electron.listen('mediaNextTrack', nextFile)
electron.listen('mediaPreviousTrack', previousFile)
