const { test, expect, _electron: electron } = require('@playwright/test')

test('example test', async () => {
  const electronApp = await electron.launch({ args: ['.'] })
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    // this runs in electron's main process, parameter here is always the result of the require('electron') in the main app script
    return app.isPackaged
  })

  expect(isPackaged).toBe(false)

  // wait for the first BrowserWindow to open and return its Page object
  // const window = await electronApp.firstWindow()

  await electronApp.close()
})
