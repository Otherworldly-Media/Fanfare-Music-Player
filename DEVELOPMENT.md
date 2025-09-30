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

The app uses the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) to play media, which natively supports [FLAC](https://en.wikipedia.org/wiki/FLAC), [MP3](https://en.wikipedia.org/wiki/MP3), [AAC](https://en.wikipedia.org/wiki/Advanced_Audio_Coding), [Opus](https://en.wikipedia.org/wiki/Opus_(audio_format)), [Vorbis](https://en.wikipedia.org/wiki/Vorbis), and [WAV](https://en.wikipedia.org/wiki/WAV) files.

If attempting to play a file that is not natively supported, the app will first check to see if it is a file format for which there is special code to handle it. At the moment, the only file format supported that way is [SPC](https://wiki.superfamicom.org/spc-and-rsn-file-format).

If the file cannot play via any of the above methods, then the file will be converted to FLAC using [FFmpeg](https://ffmpeg.org), then will be played that way. This technique allows fanfare to add support for a wide range of uncommonly supported file formats, such as [ALAC](https://en.wikipedia.org/wiki/Apple_Lossless_Audio_Codec), [AIFF](https://en.wikipedia.org/wiki/Audio_Interchange_File_Format), [WMA](https://en.wikipedia.org/wiki/Windows_Media_Audio), and more.
