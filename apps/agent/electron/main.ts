import path from 'node:path';
import { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain } from 'electron';
import { loadOrCreateTokens, type AgentTokens } from '../src/tokens';
import { BrowserManager, type BrowserManager as BM } from '../src/browser';
import { HarvestRunner } from '../src/harvestRunner';
import { createAgentServer } from '../src/server';

let tray: Tray | null = null;
let win: BrowserWindow | null = null;
let tokens: AgentTokens;
let browsers: BM;
let runner: HarvestRunner;

function icon(): Electron.NativeImage {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAMUlEQVR4nGWPMQIAIAwDne/9D+1oJUZgxZ3dPWxVJZ0tW7Zs2bJly5YtW7Zs2bK1yZc9TgF0CjEeCAAAAABJRU5ErkJggg==',
    'base64'
  );
  return nativeImage.createFromBuffer(png);
}

function showWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return;
  }
  win = new BrowserWindow({
    width: 480,
    height: 460,
    resizable: false,
    title: 'Comment Intelligence Agent',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'ui.html'));
  win.on('closed', () => {
    win = null;
  });
}

function refreshTray(stateLabel: string): void {
  if (!tray) return;
  tray.setToolTip(`Comment Intelligence \u2014 ${stateLabel}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Estado: ${stateLabel}`, enabled: false },
      { label: 'Abrir panel', click: () => showWindow() },
      { label: 'Salir', click: () => app.quit() }
    ])
  );
}

async function start(): Promise<void> {
  tokens = loadOrCreateTokens();
  browsers = new BrowserManager();
  runner = new HarvestRunner(browsers);

  ipcMain.handle('open-browser', async (_e, platform: string) => {
    await browsers.openForLogin(platform === 'facebook' ? 'facebook' : platform === 'tiktok' ? 'tiktok' : 'instagram');
    return browsers.status;
  });

  const server = createAgentServer({
    tokens,
    browsers,
    runner,
    onStateChange: (s) => {
      refreshTray(s.state + ' \u00b7 navegador: ' + s.browser);
      try {
        win?.webContents.send('agent-state', s);
      } catch {}
    }
  });

  showWindow();
  win?.webContents.on('did-finish-load', () => {
    win?.webContents.send('agent-info', { port: 0, pairingCode: tokens.pairingCode, version: '0.1.0' });
  });

  try {
    const port = await server.start();
    refreshTray('IDLE');
    win?.webContents.on('did-finish-load', () => {
      win?.webContents.send('agent-info', { port, pairingCode: tokens.pairingCode, version: '0.1.0' });
    });
    win?.webContents.send('agent-info', { port, pairingCode: tokens.pairingCode, version: '0.1.0' });
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    const friendly = msg.includes('EADDRINUSE')
      ? 'Ya hay otro Comment Intelligence Agent corriendo (puerto 8765). Ci\u00e9rralo (revisa la bandeja y terminales abiertas) y vuelve a abrir esta aplicaci\u00f3n.'
      : 'Error al iniciar: ' + msg.slice(0, 200);
    refreshTray('ERROR');
    win?.webContents.send('agent-error', friendly);
    win?.webContents.on('did-finish-load', () => {
      win?.webContents.send('agent-error', friendly);
    });
  }
}

app.whenReady().then(() => {
  tray = new Tray(icon());
  tray.setToolTip('Comment Intelligence');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Iniciando...', enabled: false }, { label: 'Salir', click: () => app.quit() }]));
  start().catch((err) => {
    console.error(err);
    showWindow();
    win?.webContents.send('agent-error', String((err as Error)?.message || err));
  });
});

app.on('window-all-closed', () => {});

app.on('before-quit', async () => {
  if (browsers) await browsers.closeAll().catch(() => undefined);
});
