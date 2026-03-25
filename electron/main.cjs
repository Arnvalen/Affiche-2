const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

// Enregistre app:// comme origine sécurisée → showDirectoryPicker() fonctionne
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Nexans — Éditeur d'affiche",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })
  win.setMenuBarVisibility(false)
  win.loadURL('app://localhost/')
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
    const filePath = path.join(__dirname, '..', 'dist', file)
    return net.fetch(pathToFileURL(filePath).href).catch(() =>
      net.fetch(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href)
    )
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
