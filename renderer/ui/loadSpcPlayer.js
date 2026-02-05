// this is a hard fork of https://github.com/telinc1/smwcentral-spc-player to repurpose it as a generic converter for SPC files to PCM audio data

module.exports = async () => {
  // setup for the spc.wasm module
  const SPCPlayerWasmModule = {}

  // map internal wasm functions to named js functions
  SPCPlayerWasmModule._main = (...args) => SPCPlayerWasmModule.asm.j(...args)
  SPCPlayerWasmModule._load = (...args) => SPCPlayerWasmModule.asm.k(...args)
  SPCPlayerWasmModule._play = (...args) => SPCPlayerWasmModule.asm.l(...args)
  SPCPlayerWasmModule._seek = (...args) => SPCPlayerWasmModule.asm.m(...args)
  SPCPlayerWasmModule._malloc = (...args) => SPCPlayerWasmModule.asm.n(...args)
  SPCPlayerWasmModule._free = (...args) => SPCPlayerWasmModule.asm.o(...args)
  SPCPlayerWasmModule.stackAlloc = (...args) => SPCPlayerWasmModule.asm.p(...args)

  // spc player logic that is implemented in the js layer
  const SPCPlayer = {
    audioContext: null,
    gainNode: null,
    rateRatio: 0,
    lastSample: 0,
    bufferPointer: 0,
    bufferSize: 0,
    spcPointer: null,
    channelBuffers: [new Float32Array(16384), new Float32Array(16384)],

    initialize: function () {
      this.audioContext = new window.AudioContext()
      this.gainNode = this.audioContext.createGain()
      this.rateRatio = 32e3 / this.audioContext.sampleRate
      this.lastSample = 1 + Math.floor(16384 * this.rateRatio)
      this.bufferSize = 4 * (this.lastSample - 1)
      this.bufferPointer = SPCPlayerWasmModule._malloc(this.bufferSize + 4)
      this.gainNode.connect(this.audioContext.destination)
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

    renderToPCMBuffer: async function (spcArrayBuffer) {
      return new Promise((resolve) => {
        const sampleRate = 48000
        const numChannels = 2
        const { duration, fade } = this.getDurationAndFade(spcArrayBuffer)
        const totalSamples = Math.floor(duration * sampleRate)
        const fadeSamples = Math.floor((fade / 1000) * sampleRate)
        const left = new Float32Array(totalSamples)
        const right = new Float32Array(totalSamples)

        // allocate and load SPC into WASM
        if (this.spcPointer) SPCPlayerWasmModule._free(this.spcPointer)
        this.spcPointer = SPCPlayerWasmModule._malloc(spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)
        SPCPlayerWasmModule.HEAPU8.set(spcArrayBuffer, this.spcPointer)
        SPCPlayerWasmModule._load(this.spcPointer, spcArrayBuffer.length * Uint8Array.BYTES_PER_ELEMENT)

        const bufferSize = this.channelBuffers[0].length
        const tempLeft = new Float32Array(bufferSize)
        const tempRight = new Float32Array(bufferSize)
        let offset = 0

        // render in chunks with yields between them to prevent blocking event loop
        const renderChunk = () => {
          const chunkEnd = Math.min(offset + bufferSize * 10, totalSamples) // render 10 buffers at a time

          while (offset < chunkEnd) {
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
            offset += bufferSize
          }

          // if not done, schedule next chunk
          if (offset < totalSamples) {
            setTimeout(renderChunk, 0) // yield to event loop
          } else {
            // interleave channels
            const interleaved = new Float32Array(totalSamples * 2)
            for (let i = 0; i < totalSamples; i++) {
              interleaved[i * 2] = left[i]
              interleaved[i * 2 + 1] = right[i]
            }

            // apply fade-out
            if (fadeSamples > 0 && fadeSamples < totalSamples) {
              for (let i = 0; i < fadeSamples; i++) {
                const fadeFactor = 1 - (i / fadeSamples)
                const idx = (totalSamples - fadeSamples + i) * 2
                interleaved[idx] *= fadeFactor
                interleaved[idx + 1] *= fadeFactor
              }
            }

            resolve(new Uint8Array(interleaved.buffer, interleaved.byteOffset, interleaved.byteLength))
          }
        }

        renderChunk()
      })
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
