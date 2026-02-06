# Developing Fanfare

Fanfare is an [Electron](https://www.electronjs.org) app written with mostly vanilla HTML, CSS, and JavaScript with a sprinkling of small libraries for specific purposes.

## Run the app

### Run in development mode

- Clone this repo
- `npm ci`
- `npm start`

### Do builds

- `npm run build-self`: Builds just for your operating system.
- `npm run build`: Builds for all operating systems.

## How media playback works

Except in special cases, the app uses [FFmpeg](https://ffmpeg.org) to convert audio files in any supported format to PCM audio, then the PCM audio is loaded into the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to play media.

Special cases:

- [SPC](https://wiki.superfamicom.org/spc-and-rsn-file-format): Decoded into PCM audio by a bundled WebAssembly player.
