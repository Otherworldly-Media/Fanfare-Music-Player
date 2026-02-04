const db = global.db
const TAGLIB_ACCESSORS = require('../models/getTaglibAccessors')

module.exports = () => {
  // create library table
  let sql = `
    create table if not exists "library" (
      "file_path" text not null,
      "date_added" integer not null,`
  TAGLIB_ACCESSORS.forEach(key => {
    if (key !== 'pictures') {
      sql += `"${key}" text not null,`
    }
  })
  sql += 'primary key("file_path"))'
  db.query(sql)

  // create playlists table
  sql = `
    create table if not exists "playlists" (
      "name" text not null,
      "position" integer,
      primary key("name"))`
  db.query(sql)

  // create playlist_members table
  sql = `
    create table if not exists "playlist_members" (
      "playlist" text not null,
      "file_path" text not null,
      primary key("playlist","file_path"))`
  db.query(sql)
}
