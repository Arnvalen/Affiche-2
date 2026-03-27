const T0 = Date.now()
const { app, BrowserWindow } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

/* ═══ Flags Chromium ═══ */
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-http-cache')
const T1 = Date.now()

/* ═══ Forcer userData/sessionData/crashDumps/logs en local ═══ */
const LOCAL = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || '', 'NexansAffiche')
app.setPath('userData', path.join(LOCAL, 'data'))
app.setPath('sessionData', path.join(LOCAL, 'session'))
app.setPath('crashDumps', path.join(LOCAL, 'crashes'))
app.setAppLogsPath(path.join(LOCAL, 'logs'))

/* ═══ Logging vers fichier ═══ */
const LOG_FILE = path.join(path.dirname(process.execPath), 'affiche-debug.log')
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch (_) {}
}
process.on('uncaughtException', (e) => { log('FATAL: ' + e.stack); app.quit() })

log('T0 process start')
log('T1 switches applied (+' + (T1 - T0) + 'ms)')
log('execPath: ' + process.execPath)
log('__dirname: ' + __dirname)
log('userData: ' + app.getPath('userData'))

const DIST = path.join(__dirname, '..', 'dist')
log('DIST: ' + DIST)
log('DIST exists: ' + fs.existsSync(DIST))

/* ═══ Résolution du dossier library ═══ */
// 1. --library=PATH passé par le launcher.bat
// 2. ../library/ à côté du dossier de l'exe (exécution directe)
let LIBRARY = null
const libArg = process.argv.find(a => a.startsWith('--library='))
if (libArg) {
  LIBRARY = libArg.split('=').slice(1).join('=')
} else {
  const candidate = path.join(path.dirname(process.execPath), '..', 'library')
  if (fs.existsSync(candidate)) LIBRARY = candidate
}
if (LIBRARY && !fs.existsSync(LIBRARY)) {
  try { fs.mkdirSync(LIBRARY, { recursive: true }) } catch (_) {}
}
log('LIBRARY: ' + (LIBRARY || 'none'))

/* ═══ Pré-chargement des fichiers dist/ en RAM ═══ */
const FILE_CACHE = {}
function preloadDist() {
  const t = Date.now()
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else FILE_CACHE['/' + path.relative(DIST, full).replace(/\\/g, '/')] = fs.readFileSync(full)
    }
  }
  walk(DIST)
  log('Preloaded ' + Object.keys(FILE_CACHE).length + ' files in ' + (Date.now() - t) + 'ms')
}
preloadDist()

/* ═══ MIME types ═══ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
}

/* ═══ Serveur HTTP local ═══ */
function startServer(cb) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0])

    // ── API Version ──
    if (url === '/__api/version' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'))
      res.end(JSON.stringify({ version: pkg.version }))
      return
    }

    // ── API Library ──
    if (url.startsWith('/__api/library')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')

      if (!LIBRARY) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'no library' }))
        return
      }

      // GET /__api/library → liste des fichiers
      if (url === '/__api/library' && req.method === 'GET') {
        try {
          const entries = fs.readdirSync(LIBRARY)
          const jsons = entries.filter(n => n.endsWith('.json')).sort()
          const svgs = entries.filter(n => n.endsWith('.svg')).sort()
          res.end(JSON.stringify({ path: LIBRARY, jsons, svgs }))
        } catch (e) {
          log('LIBRARY LIST ERROR: ' + e.message)
          res.statusCode = 500
          res.end(JSON.stringify({ error: e.message }))
        }
        return
      }

      // GET /__api/library/filename → lire un fichier
      const filename = url.replace('/__api/library/', '')
      if (req.method === 'GET' && filename) {
        const filePath = path.join(LIBRARY, filename)
        if (!filePath.startsWith(LIBRARY)) { res.statusCode = 403; res.end('{}'); return }
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const ext = path.extname(filename).toLowerCase()
          res.setHeader('Content-Type', ext === '.svg' ? 'image/svg+xml' : 'application/json; charset=utf-8')
          res.end(content)
        } catch (e) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: e.message }))
        }
        return
      }

      // PUT /__api/library/filename → écrire un fichier
      if (req.method === 'PUT' && filename) {
        const filePath = path.join(LIBRARY, filename)
        if (!filePath.startsWith(LIBRARY)) { res.statusCode = 403; res.end('{}'); return }
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            fs.writeFileSync(filePath, body, 'utf-8')
            log('LIBRARY WRITE: ' + filename + ' (' + body.length + ' bytes)')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            log('LIBRARY WRITE ERROR: ' + e.message)
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })
        return
      }

      // DELETE /__api/library/filename → supprimer un fichier
      if (req.method === 'DELETE' && filename) {
        const filePath = path.join(LIBRARY, filename)
        if (!filePath.startsWith(LIBRARY)) { res.statusCode = 403; res.end('{}'); return }
        try {
          fs.unlinkSync(filePath)
          log('LIBRARY DELETE: ' + filename)
          res.end(JSON.stringify({ ok: true }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e.message }))
        }
        return
      }

      res.statusCode = 405
      res.end(JSON.stringify({ error: 'method not allowed' }))
      return
    }

    // ── Fichiers statiques (depuis le cache RAM) ──
    const ext = path.extname(url).toLowerCase()
    const cached = FILE_CACHE[url] || FILE_CACHE['/index.html']
    res.setHeader('Content-Type', MIME[ext] || MIME['.html'])
    if (cached) {
      log('HTTP ' + req.method + ' ' + url + ' -> ' + cached.length + ' bytes (RAM)')
      res.end(cached)
    } else {
      log('HTTP ' + req.method + ' ' + url + ' -> 404 NOT FOUND')
      res.statusCode = 404
      res.end('Not found')
    }
  })
  server.listen(0, '127.0.0.1', () => {
    log('T3 HTTP server on port ' + server.address().port + ' (+' + (Date.now() - T0) + 'ms)')
    cb(server.address().port)
  })
}

/* ═══ Fenêtre principale ═══ */
function createWindow(port) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#C8102E',
    show: false,
    title: "Nexans \u2014 \u00c9diteur d'affiche",
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.setMenuBarVisibility(false)
  log('T4 BrowserWindow created (+' + (Date.now() - T0) + 'ms)')

  // Splash pendant le chargement
  win.loadURL('data:text/html,' + encodeURIComponent(
    '<body style="background:#C8102E;color:white;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;font-size:24px">Chargement\u2026</body>'
  ))
  win.show()

  // Events d'instrumentation
  win.webContents.on('did-start-loading', () => log('T6 did-start-loading (+' + (Date.now() - T0) + 'ms)'))
  win.webContents.on('dom-ready', () => log('T7 dom-ready (+' + (Date.now() - T0) + 'ms)'))
  win.webContents.on('did-finish-load', () => log('T8 did-finish-load (+' + (Date.now() - T0) + 'ms)'))
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log('LOAD FAIL: ' + code + ' ' + desc + ' url=' + url))
  win.webContents.on('console-message', (_e, _lv, msg) => log('CONSOLE: ' + msg))
  win.webContents.on('render-process-gone', (_e, details) => log('RENDERER CRASH: ' + JSON.stringify(details)))

  // Charger l'app
  log('T5 loadURL http://127.0.0.1:' + port + '/ (+' + (Date.now() - T0) + 'ms)')
  win.loadURL(`http://127.0.0.1:${port}/`)
  return win
}

/* ═══ App lifecycle ═══ */
app.whenReady().then(() => {
  log('T2 app ready (+' + (Date.now() - T0) + 'ms)')
  startServer((port) => {
    createWindow(port)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port)
    })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
