module.exports = () => {
  window.dialog = (params) => {
    const dialog = `<dialog id="dialog">${params?.html || ''}</dialog>`
    document.body.insertAdjacentHTML('afterbegin', dialog)
    document.getElementById('dialog').addEventListener('close', close)
    document.querySelector('#dialog form').addEventListener('submit', close)
    async function close (event) {
      event?.preventDefault()
      if (document.getElementById('dialog')) {
        if (params.close) await params.close()
        document.getElementById('dialog').close()
        document.getElementById('dialog').remove()
      }
    }
    document.getElementById('dialog').showModal()
  }

  window.alertDialog = (params) => {
    const resetButton = params?.buttons?.reset ? `<li><button type="reset" value="reset">${params?.buttons?.reset === true ? 'Reset' : params?.buttons?.reset}</button></li>` : ''
    const dialog = `
<dialog id="dialog">
  <div>${params?.html || ''}</div>
  <form class="semanticForms noSubmit">
    <menu>
      <li><button value="ok">${params?.buttons?.ok || 'OK'}</button></li>
      ${resetButton}
    </menu>
  </form>
</dialog>`
    document.body.insertAdjacentHTML('afterbegin', dialog)
    document.getElementById('dialog').addEventListener('close', close)
    document.querySelector('#dialog form').addEventListener('submit', close)
    function close (event) {
      event?.preventDefault()
      if (document.getElementById('dialog')) {
        document.getElementById('dialog').close()
        document.getElementById('dialog').remove()
      }
    }
    document.getElementById('dialog').showModal()
  }

  window.confirmDialog = (params) => {
    return new Promise((resolve) => {
      const resetButton = params?.buttons?.reset ? `<li><button value="reset">${params?.buttons?.reset === true ? 'Reset' : params?.buttons?.reset}</button></li>` : ''
      const dialog = `
<dialog id="dialog">
  <div>${params?.html || ''}</div>
  <form method="dialog" class="semanticForms">
    <menu>
      <li><button value="ok">${params?.buttons?.ok || 'OK'}</button></li>
      <li><button value="cancel">${params?.buttons?.cancel || 'Cancel'}</button></li>
      ${resetButton}
    </menu>
  </form>
</dialog>`
      document.body.insertAdjacentHTML('afterbegin', dialog)
      const dialogEl = document.getElementById('dialog')

      function cleanup () {
        dialogEl.close()
        dialogEl.remove()
      }

      dialogEl.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault()
        resolve(true)
        cleanup()
      })

      dialogEl.querySelector('button[value="cancel"]').addEventListener('click', (event) => {
        event.preventDefault()
        resolve(false)
        cleanup()
      })

      dialogEl.addEventListener('close', () => {
        resolve(null)
        cleanup()
      })

      dialogEl.showModal()
    })
  }

  window.promptDialog = (params) => {
    return new Promise((resolve) => {
      const resetButton = params?.buttons?.reset ? `<li><button value="reset">${params?.buttons?.reset === true ? 'Reset' : params?.buttons?.reset}</button></li>` : ''
      const dialog = `
<dialog id="dialog">
  <div>${params?.html || ''}</div>
  <form method="dialog" class="semanticForms">
    <dl>
      <dt><label for="dialogInput">${params?.label || ''}</label></dt>
      <dd><input type="text" id="dialogInput" value="${params?.defaultValue || ''}"></dd>
    </dl>
    <menu>
      <li><button value="ok">${params?.buttons?.ok || 'OK'}</button></li>
      <li><button value="cancel">${params?.buttons?.cancel || 'Cancel'}</button></li>
      ${resetButton}
    </menu>
  </form>
</dialog>`
      document.body.insertAdjacentHTML('afterbegin', dialog)
      const dialogEl = document.getElementById('dialog')
      const inputEl = dialogEl.querySelector('input')

      function cleanup () {
        dialogEl.close()
        dialogEl.remove()
      }

      dialogEl.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault()
        resolve(inputEl.value)
        cleanup()
      })

      dialogEl.querySelector('button[value="cancel"]').addEventListener('click', (event) => {
        event.preventDefault()
        resolve(null)
        cleanup()
      })

      dialogEl.addEventListener('close', () => {
        resolve(null)
        cleanup()
      })

      dialogEl.showModal()
      window.setTimeout(() => {
        inputEl.focus()
        inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length
      }, 0)
    })
  }
}
