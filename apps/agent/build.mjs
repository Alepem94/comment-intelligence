import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  logLevel: 'info',
  external: ['electron', 'playwright', 'playwright-core', 'ws', 'ws/*']
};

await build({
  ...common,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/agent.cjs'
});

await build({
  ...common,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.cjs'
});

await build({
  ...common,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist-electron/preload.cjs'
});

copyFileSync('electron/ui.html', 'dist-electron/ui.html');
console.log('copied ui.html -> dist-electron/ui.html');

