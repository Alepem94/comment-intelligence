import { createAgentServer } from './server';
import { BrowserManager } from './browser';
import { HarvestRunner } from './harvestRunner';
import { loadOrCreateTokens } from './tokens';
import { AGENT_NAME, AGENT_VERSION, agentPort, ensureDirs } from './config';

export function startCli(): void {
  ensureDirs();
  const tokens = loadOrCreateTokens();
  const browsers = new BrowserManager();
  const runner = new HarvestRunner(browsers);
  const server = createAgentServer({ tokens, browsers, runner });

  void server.start().then((port) => {
    const shownPort = port || agentPort();
    console.log('');
    console.log('  ' + AGENT_NAME + ' v' + AGENT_VERSION);
    console.log('  -------------------------------');
    console.log('  Estado:     conectado y a la espera');
    console.log('  Puerto:     ' + shownPort);
    console.log('  C\u00f3digo de emparejamiento: ' + tokens.pairingCode);
    console.log('');
    console.log('  Pega este c\u00f3digo en la web app para conectar.');
    console.log('  Mant\u00e9n esta ventana abierta mientras usas la herramienta.');
    console.log('');
  });
}

if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  startCli();
}
