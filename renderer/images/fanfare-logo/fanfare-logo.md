How the Fanfare app icon was made
===

- Icon originally made in 2025
- Made background with desired shape and gradient in macOS Icon Composer Version 1.0 (41) on macOS Sequoia https://developer.apple.com/icon-composer/
- Exported it to PNG
- Loaded the PNG into GIMP 3.0.4
- Shrank it to 824x824
- Created a new 1024x1024 graphic with a transparent background and placed the 824x824 app background image in the center of the new graphic
- Created new layer and overlayed trumpet icon by Dennis Suitters from https://www.svgrepo.com/svg/444150/music-trumpet in the center at 800x800 resolution
- Removed top trumpet valve because trumpets typically have 3 valves, not 4.
- Added drop shadow on app icon layer:
  - Values:
    - X: 0
    - Y: 20
    - Blur radius: 10
    - Grow shape: circle
    - Grow radius: 0
    - Color: black
    - Opacity: 0.5
    - Clipping: adjust
    - Blending: options
      - Mode: replace
      - Opacity: 100
    - Preview: yes
    - Merge filter: no
    - Split view: no
- Added drop shadow on trumpet layer:
  - values:
    - X: 20
    - Y: 20
    - Blur radius: 10
    - Grow shape: circle
    - Grow radius: 0
    - Color: black
    - Opacity: 0.5
    - Clipping: adjust
    - Blending: options
      - Mode: replace
      - Opacity: 100
    - Preview: yes
    - Merge filter: no
    - Split view: no

### How to make Mac icon.icns file from macOS

```
cd build
mkdir icon.iconset
cp icon.png icon.iconset/icon_512x512@2x.png
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

### How to make icon.icns file from Linux

- Install icnsutils: `sudo apt-get install icnsutils`
- Install imagemagick: `sudo apt-get install imagemagick`

```
cd build
mkdir icon.iconset
cp icon.png icon.iconset/icon_512x512@2x.png
convert icon.png -resize 16x16 icon.iconset/icon_16x16.png
convert icon.png -resize 32x32 icon.iconset/icon_16x16@2x.png
convert icon.png -resize 32x32 icon.iconset/icon_32x32.png
convert icon.png -resize 64x64 icon.iconset/icon_32x32@2x.png
convert icon.png -resize 128x128 icon.iconset/icon_128x128.png
convert icon.png -resize 256x256 icon.iconset/icon_128x128@2x.png
convert icon.png -resize 256x256 icon.iconset/icon_256x256.png
convert icon.png -resize 512x512 icon.iconset/icon_256x256@2x.png
convert icon.png -resize 512x512 icon.iconset/icon_512x512.png
png2icns icon.icns icon.iconset/icon_*.png
rm -rf icon.iconset
```

