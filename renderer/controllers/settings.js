module.exports = (app) => {
  app.route('/settings').get(async (req, res) => {
    res.target = '#content > article'
    res.render('settings', {}, async () => {
      // settings page not implemented yet
    })
  })
}
