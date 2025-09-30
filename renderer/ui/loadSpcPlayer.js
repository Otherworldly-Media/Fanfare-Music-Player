// this is a hard fork of https://github.com/telinc1/smwcentral-spc-player to simplify and genericize it better, as well as to add some features

function encodeWAV (samples, sampleRate, numChannels) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  // RIFF identifier 'RIFF'
  view.setUint32(0, 0x52494646, false)
  // file length minus RIFF identifier length and file description length
  view.setUint32(4, 36 + samples.length * 2, true)
  // RIFF type 'WAVE'
  view.setUint32(8, 0x57415645, false)
  // format chunk identifier 'fmt '
  view.setUint32(12, 0x666d7420, false)
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (raw)
  view.setUint16(20, 1, true)
  // channel count
  view.setUint16(22, numChannels, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * 2, true)
  // bits per sample
  view.setUint16(34, 16, true)
  // data chunk identifier 'data'
  view.setUint32(36, 0x64617461, false)
  // data chunk length
  view.setUint32(40, samples.length * 2, true)

  // write the PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    // clamp and convert float [-1,1] to int16
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

module.exports = async () => {
  // setup for the spc.wasm module
  const SPCPlayerWasmModule = {}

  // map internal wasm functions to named js functions
  SPCPlayerWasmModule._main = function () {
    return SPCPlayerWasmModule.asm.j.apply(null, arguments)
  }
  SPCPlayerWasmModule._load = function () {
    return SPCPlayerWasmModule.asm.k.apply(null, arguments)
  }
  SPCPlayerWasmModule._play = function () {
    return SPCPlayerWasmModule.asm.l.apply(null, arguments)
  }
  SPCPlayerWasmModule._seek = function () {
    return SPCPlayerWasmModule.asm.m.apply(null, arguments)
  }
  SPCPlayerWasmModule._malloc = function () {
    return SPCPlayerWasmModule.asm.n.apply(null, arguments)
  }
  SPCPlayerWasmModule._free = function () {
    return SPCPlayerWasmModule.asm.o.apply(null, arguments)
  }
  SPCPlayerWasmModule.stackAlloc = function () {
    return SPCPlayerWasmModule.asm.p.apply(null, arguments)
  }

  // spc player logic that is implemented in the js layer
  const SPCPlayer = {
    audioContext: null,
    gainNode: null,
    scriptProcessorNode: null,
    rateRatio: 0,
    lastSample: 0,
    bufferPointer: 0,
    bufferSize: 0,
    spcPointer: null,
    channelBuffers: [new Float32Array(16384), new Float32Array(16384)],
    hasNewChannelData: false,
    startedAt: 0,

    initialize: function () {
      this.audioContext = new window.AudioContext()
      this.gainNode = this.audioContext.createGain()
      this.rateRatio = 32e3 / this.audioContext.sampleRate
      this.lastSample = 1 + Math.floor(16384 * this.rateRatio)
      this.bufferSize = 4 * (this.lastSample - 1)
      this.bufferPointer = SPCPlayerWasmModule._malloc(this.bufferSize + 4)
      this.play = this.play.bind(this)
      this.copyBuffers = this.copyBuffers.bind(this)
      this.gainNode.connect(this.audioContext.destination)
    },

    load: function (spcArrayBuffer) {
      this.stop()
      this.scriptProcessorNode?.disconnect(this.gainNode)
      this.spcPointer = SPCPlayerWasmModule._malloc(spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
      SPCPlayerWasmModule.HEAPU8.set(spcArrayBuffer, this.spcPointer)
      SPCPlayerWasmModule._load(this.spcPointer, spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
      const metadata = this.getDurationAndFade(spcArrayBuffer)
      this.fadeDuration = metadata.fade
      this.duration = metadata.duration
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(this.channelBuffers[0].length, 0, this.channelBuffers.length)
      this.scriptProcessorNode.onaudioprocess = this.copyBuffers
      this.startedAt = this.audioContext.currentTime
      this.scriptProcessorNode.connect(this.gainNode)
    },

    stop: function () {
      SPCPlayerWasmModule._free(this.spcPointer)
      this.spcPointer = null
      this.stopProgressLoop()
    },

    pause: function () {
      this.audioContext.suspend()
      this.stopProgressLoop()
    },

    resume: function () {
      this.audioContext.resume()
      this.startProgressLoop()
    },

    getTime: function () {
      return this.audioContext.currentTime - this.startedAt
    },

    getVolume: function () {
      return this.gainNode.gain.value
    },

    setVolume: function (volume) {
      this.gainNode.gain.setValueAtTime(volume, 0)
    },

    fadeOut: function (duration) {
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, 0)
      this.gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)
    },

    getSample: function (channel, index) {
      const offset = this.rateRatio * index
      const bufferOffset = Math.floor(offset)
      if (bufferOffset + 1 > this.lastSample) throw new RangeError('Buffer overflow for sample '.concat(index, ' in channel ').concat(channel))
      const high = offset - bufferOffset
      const low = 1 - high
      const lowValue = SPCPlayerWasmModule.HEAP16[channel + this.bufferPointer / 2 + bufferOffset * 2] * low
      const highValue = SPCPlayerWasmModule.HEAP16[channel + this.bufferPointer / 2 + (bufferOffset + 1) * 2] * high
      return lowValue + highValue
    },

    play: function () {
      this.resume()
      const channelBuffers = this.channelBuffers
      SPCPlayerWasmModule._play(this.bufferPointer, this.lastSample * 2)
      for (let channel = 0; channel < channelBuffers.length; channel += 1) {
        const buffer = channelBuffers[channel]
        for (let index = 0; index < buffer.length; index++) {
          buffer[index] = this.getSample(channel, index) / 32e3
        }
      }
      this.hasNewChannelData = true
    },

    seek: function (spcArrayBuffer, time) {
      this.stop()
      this.scriptProcessorNode?.disconnect(this.gainNode)
      this.spcPointer = SPCPlayerWasmModule._malloc(spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
      SPCPlayerWasmModule.HEAPU8.set(spcArrayBuffer, this.spcPointer)
      SPCPlayerWasmModule._load(this.spcPointer, spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
      SPCPlayerWasmModule._seek(time)
      const metadata = this.getDurationAndFade(spcArrayBuffer)
      this.fadeDuration = metadata.fade
      this.duration = metadata.duration
      this.scriptProcessorNode = this.audioContext.createScriptProcessor(this.channelBuffers[0].length, 0, this.channelBuffers.length)
      this.scriptProcessorNode.onaudioprocess = this.copyBuffers
      this.startedAt = this.audioContext.currentTime - time
      this.scriptProcessorNode.connect(this.gainNode)
      this.startProgressLoop()
      this.play()
    },

    copyBuffers: function (_ref) {
      const outputBuffer = _ref.outputBuffer
      if (this.spcPointer === null || this.audioContext.state !== 'running') return
      if (!this.hasNewChannelData) this.play()
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel += 1) {
        outputBuffer.copyToChannel(this.channelBuffers[channel], channel, 0)
      }
      this.hasNewChannelData = false
      this.play()
    },

    getDurationAndFade: (spcArrayBuffer) => {
      function extractString (bytes, start, length) {
        let realLength
        realLength = 0
        while (realLength < length && bytes[start + realLength] !== 0) {
          realLength += 1
        }
        return new TextDecoder('latin1').decode(bytes.slice(start, start + realLength))
      }

      const array = new Uint8Array(spcArrayBuffer)
      return {
        duration: Number(extractString(array, 169, 3)),
        fade: Number(extractString(array, 172, 4))
      }
    },

    startProgressLoop: function () {
      if (this._progressLoopRunning) return
      this._progressLoopRunning = true
      let lastUpdate = 0
      const loop = () => {
        if (!this._progressLoopRunning) return
        const now = performance.now()
        const currentTime = this.getTime()
        if (now - lastUpdate >= 200) { // only update every 200ms
          this.songProgressCallback?.(currentTime)
          lastUpdate = now
        }
        if (typeof this.duration === 'number' && currentTime >= this.duration) {
          SPCPlayer.fadeOut(SPCPlayer.fadeDuration / 1000)
          this.songBeginFadeOutCallback?.()
          if (!this.ending) {
            this.ending = window.setTimeout(() => {
              SPCPlayer.stop()
              this.songEndCallback?.()
            }, SPCPlayer.fadeDuration)
          }
          this._progressLoopRunning = false
          return
        }
        this._progressLoopId = window.requestAnimationFrame(loop)
      }
      this._progressLoopId = window.requestAnimationFrame(loop)
    },

    stopProgressLoop: function () {
      this._progressLoopRunning = false
      if (this._progressLoopId) {
        window.cancelAnimationFrame(this._progressLoopId)
        this._progressLoopId = null
      }
    },

    onProgress: function (callback) {
      this.songProgressCallback = callback
    },

    onBeginFadeOut: function (callback) {
      this.songBeginFadeOutCallback = callback
    },

    onEnd: function (callback) {
      this.songEndCallback = callback
    },

    renderToWavBlob: async function (spcArrayBuffer) {
      const sampleRate = 48000
      const numChannels = 2
      const { duration, fade } = this.getDurationAndFade(spcArrayBuffer)
      const totalSamples = Math.floor(duration * sampleRate)
      const fadeSamples = Math.floor((fade / 1000) * sampleRate)
      const left = new Float32Array(totalSamples)
      const right = new Float32Array(totalSamples)

      // Allocate and load SPC into WASM, but do NOT initialize AudioContext or ScriptProcessorNode
      if (this.spcPointer) SPCPlayerWasmModule._free(this.spcPointer)
      this.spcPointer = SPCPlayerWasmModule._malloc(spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
      SPCPlayerWasmModule.HEAPU8.set(spcArrayBuffer, this.spcPointer)
      SPCPlayerWasmModule._load(this.spcPointer, spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)

      // Prepare buffer for WASM output
      const bufferSize = this.channelBuffers[0].length
      const tempLeft = new Float32Array(bufferSize)
      const tempRight = new Float32Array(bufferSize)

      let offset = 0
      while (offset < totalSamples) {
        // Call the WASM play routine directly
        SPCPlayerWasmModule._play(this.bufferPointer, this.lastSample * 2)
        for (let channel = 0; channel < numChannels; channel++) {
          for (let i = 0; i < bufferSize; i++) {
            const sample = this.getSample(channel, i) / 32e3
            if (channel === 0) tempLeft[i] = sample
            else tempRight[i] = sample
          }
        }
        const chunkSize = Math.min(bufferSize, totalSamples - offset)
        left.set(tempLeft.subarray(0, chunkSize), offset)
        right.set(tempRight.subarray(0, chunkSize), offset)
        offset += chunkSize
      }

      // Interleave channels
      const interleaved = new Float32Array(totalSamples * 2)
      for (let i = 0; i < totalSamples; i++) {
        interleaved[i * 2] = left[i]
        interleaved[i * 2 + 1] = right[i]
      }

      // Apply fade-out to the last fadeSamples
      if (fadeSamples > 0 && fadeSamples < totalSamples) {
        for (let i = 0; i < fadeSamples; i++) {
          const fadeFactor = 1 - (i / fadeSamples) // linear fade
          const idx = (totalSamples - fadeSamples + i) * 2
          interleaved[idx] *= fadeFactor // left
          interleaved[idx + 1] *= fadeFactor // right
        }
      }

      return encodeWAV(interleaved, sampleRate, numChannels)
    }
  }

  // convert spc wasm to array buffer
  const binary = atob(require('ui/getSpcPlayerWasmBase64'))
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)

  // init spc wasm
  const wasmMemory = new window.WebAssembly.Memory({
    initial: 16777216 / 65536, // INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE
    maximum: 16777216 / 65536 // INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE
  })
  const wasmModulePromise = window.WebAssembly.instantiate(bytes.buffer, {
    // set js callbacks for js functions that are called by the wasm blob
    a: {
      a: () => {}, // ___assert_fail
      b: (code, sigPtr, argbuf) => { // _emscripten_asm_const_iii
        if (code === 1103) SPCPlayer.initialize()
      },
      f: (dest, src, num) => { // _emscripten_memcpy_big
        SPCPlayerWasmModule.HEAPU8.copyWithin(dest, src, src + num)
      },
      g: () => {}, // _emscripten_resize_heap
      c: () => {}, // _exit
      h: () => {}, // _fd_close
      e: () => {}, // _fd_seek
      d: () => {}, // _fd_write

      // pass data to the wasm blob
      memory: wasmMemory,
      table: new WebAssembly.Table({
        initial: 4,
        maximum: 4 + 0,
        element: 'anyfunc'
      })
    }
  })

  // start the wasm module
  await wasmModulePromise.then((output) => {
    const buffer = wasmMemory.buffer
    SPCPlayerWasmModule.HEAP16 = new Int16Array(buffer)
    SPCPlayerWasmModule.HEAP32 = new Int32Array(buffer)
    SPCPlayerWasmModule.HEAPU8 = new Uint8Array(buffer)
    SPCPlayerWasmModule.HEAP32[5216 >> 2] = 5248256 // 5216 = DYNAMICTOP_PTR; 5248256 = DYNAMIC_BASE
    SPCPlayerWasmModule.asm = output.instance.exports
    const argv = SPCPlayerWasmModule.stackAlloc(8)
    SPCPlayerWasmModule.HEAP32[(argv >> 2) + 1] = 0
    SPCPlayerWasmModule._main(1, argv)
  })

  return SPCPlayer
}
