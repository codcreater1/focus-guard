const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');

const isDev = process.env.NODE_ENV !== 'production';
const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';

let mainWindow;
let focusActive = false;
let blockedSites = [];
let blockedApps = [];
let monitorInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (focusActive) {
      e.preventDefault();
      mainWindow.webContents.send('exit-blocked', 'Focus session is active. Stop it first.');
    }
  });
}

// ── PowerShell ile UAC yükseltmesi ───────────────────────────────────────────
// Start-Process powershell -Verb RunAs ile UAC popup açar ve admin olarak çalıştırır
function runAsAdmin(psScript) {
  const tmp = path.join(os.tmpdir(), 'fg_script_' + Date.now() + '.ps1');
  fs.writeFileSync(tmp, psScript, 'utf8');
  try {
    execSync(
      `powershell -NoProfile -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \\"${tmp}\\"' -Verb RunAs -Wait"`,
      { stdio: 'pipe', timeout: 15000 }
    );
    return true;
  } catch (e) {
    return { error: e.message };
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

function appendHosts(sites) {
  try {
    const entries = sites
      .flatMap((s) => ['127.0.0.1 ' + s, '127.0.0.1 www.' + s])
      .join('\r\n');
    const block = '\r\n# FOCUS-GUARD-START\r\n' + entries + '\r\n# FOCUS-GUARD-END\r\n';

    const psScript = [
      `$hostsPath = '${HOSTS_PATH}'`,
      `$content = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue`,
      `if ($content -notmatch '# FOCUS-GUARD-START') {`,
      `  Add-Content -Path $hostsPath -Value '${block.replace(/'/g, "''")}' -Encoding UTF8`,
      `}`,
      `ipconfig /flushdns | Out-Null`,
    ].join('\n');

    const result = runAsAdmin(psScript);
    if (result && result.error) return { error: result.error };
    return true;
  } catch (err) {
    return { error: err.message };
  }
}

function removeHosts() {
  try {
    const psScript = [
      `$hostsPath = '${HOSTS_PATH}'`,
      `$content = Get-Content $hostsPath -Raw`,
      `$cleaned = $content -replace '(?ms)\\r?\\n# FOCUS-GUARD-START.*?# FOCUS-GUARD-END\\r?\\n', ''`,
      `Set-Content -Path $hostsPath -Value $cleaned -Encoding UTF8 -NoNewline`,
      `ipconfig /flushdns | Out-Null`,
    ].join('\n');
    runAsAdmin(psScript);
  } catch (_) {}
}

function flushDNS() {
  try { execSync('ipconfig /flushdns', { stdio: 'ignore' }); } catch (_) {}
}

// ── Process monitor ────────────────────────────────────────────────────────────
function startProcessMonitor(apps) {
  monitorInterval = setInterval(() => {
    if (!focusActive) return;
    try {
      const out = execSync('tasklist /fo csv /nh', { encoding: 'utf8', stdio: 'pipe' });
      const processList = out
        .split('\n')
        .map((l) => l.replace(/"/g, '').split(',')[0]?.trim().toLowerCase())
        .filter(Boolean);

      for (const appName of apps) {
        const target = appName.toLowerCase();
        if (processList.some((p) => p.includes(target))) {
          try { execSync(`taskkill /f /im "${appName}" /t`, { stdio: 'ignore' }); } catch (_) {}
          mainWindow?.webContents.send('app-killed', { name: appName, ts: Date.now() });
        }
      }
    } catch (_) {}
  }, 1000);
}

function stopProcessMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('start-focus', async (_, { sites, apps }) => {
  if (focusActive) return { ok: false, reason: 'Already active' };
  blockedSites = sites || [];
  blockedApps = apps || [];
  focusActive = true;

  const hostsResult = appendHosts(blockedSites);
  if (hostsResult && hostsResult.error) {
    focusActive = false;
    return { ok: false, reason: 'Hosts: ' + hostsResult.error };
  }

  startProcessMonitor(blockedApps);
  return { ok: true };
});

ipcMain.handle('stop-focus', async () => {
  if (!focusActive) return { ok: false };
  focusActive = false;
  stopProcessMonitor();
  removeHosts();
  return { ok: true };
});

ipcMain.handle('get-status', () => ({
  active: focusActive,
  sites: blockedSites,
  apps: blockedApps,
}));

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => {
  if (!focusActive) mainWindow?.close();
  else mainWindow?.webContents.send('exit-blocked', 'Stop focus session first.');
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (focusActive) { stopProcessMonitor(); removeHosts(); }
  if (os.platform() !== 'darwin') app.quit();
});
