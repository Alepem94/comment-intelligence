import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ciAgent', {
  openBrowser: (platform: string) => ipcRenderer.invoke('open-browser', platform),
  onAgentInfo: (cb: (info: { port: number; pairingCode: string; version: string }) => void) => {
    ipcRenderer.on('agent-info', (_e, info) => cb(info));
  },
  onAgentState: (cb: (state: unknown) => void) => {
    ipcRenderer.on('agent-state', (_e, state) => cb(state));
  },
  onAgentError: (cb: (msg: string) => void) => {
    ipcRenderer.on('agent-error', (_e, msg) => cb(msg));
  }
});
