const T0 = Date.now()
const { app, BrowserWindow } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

/* ═══ Flags Chromium ═══ */
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('in-process-gpu')
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
let SHARED_LOG = null  // initialisé après résolution de LIBRARY
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch (_) {}
  if (SHARED_LOG) try { fs.appendFileSync(SHARED_LOG, line) } catch (_) {}
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

/* ═══ Log partagé sur le lecteur réseau ═══ */
if (LIBRARY) {
  try {
    const logsDir = path.join(LIBRARY, '..', 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const user = (process.env.USERNAME || process.env.USER || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
    const date = new Date().toISOString().slice(0, 10)
    SHARED_LOG = path.join(logsDir, `affiche_${user}_${date}.log`)
    log('SHARED_LOG: ' + SHARED_LOG)
  } catch (e) {
    log('SHARED_LOG init failed: ' + e.message)
  }
}

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
    backgroundColor: '#ffffff',
    show: false,
    title: "Nexans \u2014 \u00c9diteur d'affiche",
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.setMenuBarVisibility(false)
  log('T4 BrowserWindow created (+' + (Date.now() - T0) + 'ms)')

  // Splash pendant le chargement
  const logoB64 = fs.readFileSync(path.join(__dirname, 'nexans-logo.png')).toString('base64')
  const splashHTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#212121;font-family:'Segoe UI',system-ui,sans-serif;
  height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  overflow:hidden;user-select:none}
.logo{width:260px;opacity:0;animation:fadeIn .5s ease-out .1s forwards}
.title{font-size:13px;font-weight:300;letter-spacing:3px;text-transform:uppercase;
  margin-top:24px;margin-bottom:52px;color:#888;opacity:0;animation:fadeIn .5s ease-out .4s forwards}
.bar-wrap{width:200px;height:2px;background:#eee;border-radius:1px;
  overflow:hidden;opacity:0;animation:fadeIn .4s ease-out .6s forwards}
.bar{width:40%;height:100%;background:#C8102E;border-radius:1px;
  animation:slide 1.4s ease-in-out infinite}
.credits{position:absolute;bottom:24px;text-align:center;font-size:10px;
  letter-spacing:.3px;line-height:1.9;color:#bbb;opacity:0;
  animation:fadeIn .5s ease-out .8s forwards}
.credits b{color:#999;font-weight:500}
.version{position:absolute;top:14px;right:18px;font-size:10px;
  color:#ddd;opacity:0;animation:fadeIn .5s ease-out 1s forwards}
@keyframes fadeIn{to{opacity:1}}
@keyframes slide{0%{transform:translateX(-100%)}50%{transform:translateX(250%)}100%{transform:translateX(-100%)}}
</style></head><body>
<img class="logo" src="data:image/png;base64,${logoB64}">
<div class="title">\u00c9diteur d\u2019affiche \u2014 Ligne de production</div>
<div class="bar-wrap"><div class="bar"></div></div>
<div class="credits">D\u00e9velopp\u00e9 par <b>Arnaud Valente Jacot-Descombes</b><br>D\u00e9partement Quality Management \u2014 Nexans</div>
<div class="version">v${app.getVersion()}</div>
</body></html>`
  win.loadURL('data:text/html,' + encodeURIComponent(splashHTML))
  win.show()

  // Machine à états : SPLASH_LOADING → SPLASH_VISIBLE → APP_LOADING → APP_READY
  // Le timer 5s démarre quand le splash est réellement rendu, pas depuis T0
  let phase = 'SPLASH_LOADING'

  function scheduleAppLoad(delay) {
    const FADE_MS = 600
    setTimeout(() => {
      if (phase !== 'SPLASH_VISIBLE') return
      win.webContents.executeJavaScript(
        'document.body.style.cssText+="transition:opacity .6s ease;opacity:0"'
      ).catch(() => {})
    }, Math.max(0, delay - FADE_MS))
    setTimeout(() => {
      if (phase !== 'SPLASH_VISIBLE') return
      phase = 'APP_LOADING'
      log('T5 loadURL http://127.0.0.1:' + port + '/ (+' + (Date.now() - T0) + 'ms)')
      win.webContents.insertCSS('body{opacity:0!important;transition:opacity .6s ease .1s}').catch(() => {})
      win.loadURL(`http://127.0.0.1:${port}/`)
    }, delay)
  }

  win.webContents.on('did-start-loading', () => log('T6 did-start-loading (+' + (Date.now() - T0) + 'ms)'))
  win.webContents.on('dom-ready', () => log('T7 dom-ready (+' + (Date.now() - T0) + 'ms)'))
  win.webContents.on('did-finish-load', () => {
    log('T8 did-finish-load phase=' + phase + ' (+' + (Date.now() - T0) + 'ms)')
    if (phase === 'SPLASH_LOADING') {
      phase = 'SPLASH_VISIBLE'
      scheduleAppLoad(5000)  // timer 5s depuis que le splash est visible
    } else if (phase === 'APP_LOADING') {
      phase = 'APP_READY'
      win.webContents.executeJavaScript('document.body.style.opacity="1"').catch(() => {})
    }
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log('LOAD FAIL: ' + code + ' ' + desc + ' url=' + url))
  win.webContents.on('console-message', (_e, _lv, msg) => log('CONSOLE: ' + msg))
  win.webContents.on('render-process-gone', (_e, details) => log('RENDERER CRASH: ' + JSON.stringify(details)))

  // Fallback : si le splash ne charge pas en 20s (renderer bloqué), forcer l'app
  setTimeout(() => {
    if (phase === 'SPLASH_LOADING') {
      log('SPLASH TIMEOUT - forcing app load')
      phase = 'SPLASH_VISIBLE'
      scheduleAppLoad(0)
    }
  }, 20000)
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
  if (process.platform !== 'darwin') {
    log('window-all-closed → exit')
    app.exit(0)
  }
})
