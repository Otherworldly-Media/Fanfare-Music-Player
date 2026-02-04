const TAGLIB_ACCESSORS = [ // taken from https://github.com/benrr101/node-taglib-sharp/blob/develop/docs/classes/Tag.md#tagtypes
  'album', // string; set by user; e.g. 'The Downward Spiral'
  'albumArtists', // array; set by user; e.g. ['Nine Inch Nails', 'Other Artist']
  'albumArtistsSort', // array; set by user; e.g. ['Last Name, First Name'] — use this field instead of album artist when sorting by album artist if it is set
  'albumSort', // array; set by user; e.g. 'Downward Spiral' (no "The") — use this field instead of album when sorting by album if it is set
  // 'amazonId', // string; not implemented; meant for looking up a file on amazon's deprecated music metadata api
  'beatsPerMinute', // number; set by user; e.g. 89
  'comment', // string; set by user; e.g. '2012 remaster'
  'composers', // array; set by user; e.g. ['Trent Reznor']
  'composersSort', // array; set by user; e.g. ['Reznor, Trent']
  'conductor', // string; set by user; e.g. 'Bear McCreary'
  'copyright', // string; set by user; e.g. '© Some Publisher'
  'dateTagged', // Date; set when the user edits tags
  'description', // string; set by user; e.g. 'Halo 8'
  'disc', // number; set by user; e.g. 1
  'discCount', // number; set by user; e.g. 2
  'firstAlbumArtist', // string; read-only
  'firstAlbumArtistSort', // string; read-only
  'firstComposer', // string; read-only
  'firstComposerSort', // string; read-only
  'firstGenre', // string; read-only
  'firstPerformer', // string; read-only
  'firstPerformerSort', // string; read-only
  'genres', // array; set by user; e.g. ['Industrial Rock', 'Industrial Metal', 'Alternative Rock']
  'grouping', // string; set by user; e.g. some arbitrary string set by the author; not commonly used
  'initialKey', // string; set by user; e.g. 'C minor'
  'isCompilation', // boolean; set by user; e.g. for things like greatest hits albums
  'isEmpty', // boolean; read-only; returns true if no metadata is set
  'isrc', // string; set by user; e.g. 'USUAN1400011' — always 12 characters long https://en.wikipedia.org/wiki/International_Standard_Recording_Code
  'joinedAlbumArtists', // string; read-only
  'joinedComposers', // string; read-only
  'joinedGenres', // string; read-only
  'joinedPerformers', // string; read-only
  'joinedPerformersSort', // string; read-only
  'lyrics', // string; set by user; e.g. plain text or LRC format which embeds timestamps in lyrics e.g. '[00:12.00]Hello, is there anybody in there?\n[00:17.00]Just nod if you can hear me.\n[00:21.00]Is there anyone at home?' — if implementing LRC format, when playback reaches 12 seconds, the first line is shown. at 17 seconds, the next line replaces it, etc
  'musicBrainzArtistId', // string; set by the app
  'musicBrainzDiscId', // string; set by the app
  'musicBrainzReleaseArtistId', // string; set by the app
  'musicBrainzReleaseCountry', // string; set by the app
  'musicBrainzReleaseGroupId', // string; set by the app
  'musicBrainzReleaseId', // string; set by the app
  'musicBrainzReleaseStatus', // string; set by the app
  'musicBrainzReleaseType', // string; set by the app
  'musicBrainzTrackId', // string; set by the app
  // 'musicIpId', // string; not implemented; meant for looking up a file on MusicIP's deprecated music metadata api
  'performers', // array; set by user; e.g. ['Artist One', 'Guest Artist']
  'performersRole', // array; set by user; e.g. ['Vocals; Synthesizer', 'Vocals']
  'performersSort', // array; set by user; e.g. ['Last Name, First Name']
  'pictures', // array; set by user
  'publisher', // string; set by user; e.g. 'Some Publisher'
  'remixedBy', // string; set by user; e.g. 'Some Remixer'
  'replayGainAlbumGain', // number; set by user; e.g. -7.23 — the recommended adjustment [in decibels, dB] to apply to the entire album for consistent loudness
  'replayGainAlbumPeak', // number; set by user; e.g. 0.9876 — album's loudest sample (0–1 float)
  'replayGainTrackGain', // number; set by user; e.g. -6.45 — the recommended adjustment (in dB) to apply to this individual track for consistent loudness
  'replayGainTrackPeak', // number; set by user; e.g. 0.9543 — track's loudest sample (0–1 float)
  'sizeOnDisk', // number; set by the app — gets the size of the tag in bytes on disk as it was read from disk
  'subtitle', // string; set by user; e.g. 'From Star Wars: A New Hope' when title is set to 'Main Theme'
  'title', // string; set by user; e.g. 'The Downward Spiral'
  'titleSort', // string; set by user; e.g. 'Downward Spiral, The'
  'track', // number; set by user
  'trackCount', // number; set by user
  'year' // number; set by user
]

module.exports = TAGLIB_ACCESSORS
