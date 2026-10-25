import { app, BrowserWindow, dialog } from 'electron'
import { fileURLToPath } from 'node:url'

const index = new URL('../dist/index.html', import.meta.url)
let window

async function openWindow() {
  window = new BrowserWindow({
    title: 'Leofcoin Chain Manager',
    width: 1180,
    height: 850,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#10161f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  window.on('closed', () => { window = undefined })
  await window.loadFile(fileURLToPath(index))
}

function reportError(error) {
  console.error(error)
  dialog.showErrorBox('Chain Manager failed to start', error instanceof Error ? error.message : String(error))
  app.quit()
}

app.whenReady().then(openWindow).catch(reportError)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) openWindow().catch(reportError)
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
