// this file bundles css and js assets to a single file to include in the renderer html file
const fs = require('fs')
const path = require('path')
const sass = require('sass')
const webpack = require('webpack')

async function bundle () {
  if (!fs.existsSync('renderer/.build')) fs.mkdirSync('renderer/.build')

  console.log('  • compiling scss to css')
  const scss = sass.compile('./renderer/css/styles.scss')
  fs.writeFileSync('renderer/.build/styles.css', scss.css)

  // bundle js
  const webpackConfig = {
    mode: 'production',
    optimization: {
      minimize: false // prevent minification
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1 // prevents writing files like e.g. 806..renderer.bundle.js
      })
    ],
    resolve: {
      // make it possible to require('controllers/foo') and require('models/bar') without relative paths
      alias: {
        controllers: path.resolve(__dirname, '../renderer/controllers'),
        models: path.resolve(__dirname, '../models'),
        ui: path.resolve(__dirname, '../renderer/ui')
      }
    },
    target: 'electron-renderer'
  }

  // bundling the renderer js
  async function bundleRenderer () {
    console.log('  • bundling renderer.js')

    // package up the routes into a .routes.js file
    const routeList = fs.readdirSync('renderer/controllers', { recursive: true })
    let routeCode = 'module.exports = (app) => { '
    for (const file of routeList) {
      if (file.endsWith('.js')) routeCode += `require('../controllers/${file}')(app); `
    }
    fs.writeFileSync('renderer/.build/routes.js', `${routeCode}}`)

    // package up the templates into a .templates.js file
    const templateList = fs.readdirSync('renderer/views', { recursive: true })
    const templates = {}
    for (const file of templateList) {
      const fileName = path.join('renderer/views/', file)
      if (fs.lstatSync(fileName).isDirectory()) continue
      const templateCode = fs.readFileSync(path.join('renderer/views/', file), 'utf-8')
      templates[file.slice(0, -5)] = templateCode // key is the file name with no file extension
    }
    fs.writeFileSync('renderer/.build/templates.js', `module.exports = ${JSON.stringify(templates)}`)

    // make the bundle
    return new Promise((resolve, reject) => {
      const rendererWebpackConfig = webpackConfig
      rendererWebpackConfig.entry = './renderer/renderer.js'
      rendererWebpackConfig.output = {
        filename: '.build/renderer.bundle.js',
        path: path.resolve(__dirname, '../renderer')
      }
      webpack(rendererWebpackConfig, (err, stats) => {
        if (err || stats.hasErrors()) reject(err || stats.toString())
        else resolve(stats)
      })
    })
  }
  await bundleRenderer()
}

module.exports = bundle
