// this file makes the logic in bundle.js accessible as a command line tool for the package.json run scripts
async function bundle () {
  await require('./bundle')()
}

bundle()
