# Guía de desarrollo

## Requisitos

- Node.js 20+ (probado con Node 24)
- npm 10+
- Chrome o Edge instalados (para el navegador del agente)

## Comandos

```bash
npm install              # instala todos los workspaces

npm run dev:web          # web en http://localhost:3000
npm run dev:agent        # agente CLI en 127.0.0.1:8765 (imprime código de emparejamiento)

npm test                 # vitest en todos los workspaces
npm run lint             # eslint (flat config, raíz)
npm run build            # build: web (export estático) + agent (esbuild bundles)

cd apps/agent && npm run electron:dev   # agente con ventana Electron (tray) sin empaquetar
cd apps/agent && npm run package:win    # NSIS exe (solo Windows)
cd apps/agent && npm run package:mac    # DMG (solo macOS)
```

## Estructura

```
apps/web/src/
  app/page.tsx               Orquestador principal (client component)
  lib/agentClient.ts         Cliente WebSocket: pairing, reconexión, heartbeat, requests
  lib/store.ts               Estado de la app (useApp hook): filas, filtros, progreso...
  lib/idb.ts                 IndexedDB (historial local)
  lib/exportCsv.ts           CSV (usa @ci/shared) + descargas
  lib/imageExport.ts         html2canvas scale=3 → JPG/PNG/portapapeles
  lib/selfContainedHtml.ts   HTML autocontenido (tablas inline para email/docs)
  components/*               UI: tabla virtualizada, tarjetas por plataforma, paneles

apps/agent/src/
  index.ts                   Entrada CLI (dev)
  server.ts                  HTTP + WebSocket, auth por token/código, avatar-proxy
  browser.ts                 Perfiles persistentes Playwright (chrome→msedge→chromium)
  harvestRunner.ts           Puente agente↔motor: stop, diagnóstico, límites
  tokens.ts                  Token persistente + código de emparejamiento
  config.ts                  Puerto/directorios
electron/main.ts             Tray/menubar + ventana de estado (empaquetado)

packages/shared/             Tipos Comment/Progress..., errores códigos+mensajes ES,
                             detectPlatform/normalizePostUrl/extractPostId,
                             fingerprint/mergeComments, toCsv, protocolo WS
packages/scraper-core/
  adapters/instagram|facebook|tiktok.ts   pageProbe/pageExtract/pageScrollStep/pageOpenReplies
  adapters/base.ts                        interfaz Adapter + ProbeResult
  harvest.ts                              motor genérico runHarvest()
  map.ts                                  RawComment → Comment canónico
  fixtures/*.html                         DOMs de prueba SOLO para tests
```

## Cómo funciona el scraping

1. El runner abre una página nueva en el contexto persistente de la plataforma.
2. `runHarvest` serializa las funciones del adapter (`fn.toString()`) y las ejecuta con `page.evaluate`.
3. Bucle: extraer → deduplicar (`mergeComments` de shared) → emitir progreso → abrir respuestas (opcional) → scroll del contenedor detectado.
4. Parada: límite alcanzado, N rondas sin novedad (stall), usuario pulsa Detener, o timeout global.
5. Se mapea a `Comment` (campos canónicos; lo que no existe va `null`, nunca se inventa).

## Debugging

- **Ver el navegador**: siempre es headed (visible). Puedes interactuar mientras extrae.
- **Probar un adapter contra la página viva**: abre la publicación en el navegador del agente y usa "Modo diagnóstico" en la web (muestra probe + contador).
- **Tests de adapter**: los fixtures se cargan en happy-dom; cada test también hace `eval('(' + fn.toString() + ')()')` para garantizar autocontención.
```bash
cd packages/scraper-core && npx vitest -u   # correr/watch
```

## Reparar un adapter cuando cambia el DOM

1. Guarda el HTML real: en DevTools de la página viva, copia `document.querySelector('main').outerHTML` (o similar) y reemplaza el fixture correspondiente.
2. Ajusta solo ese adapter hasta pasar sus tests.
3. Nunca toques el motor genérico ni otros adapters.
4. Marca en `PROJECT_STATUS.md` la fecha de re-validación.

## Empaquetado

- `npm run build` (en apps/agent) genera `dist/agent.cjs` + `dist-electron/{main,preload}.cjs` con esbuild (externals: electron/playwright/ws → resueltos desde node_modules empaquetado).
- electron-builder empaqueta según `electron-builder.yml`. `playwright-core` va descomprimido (asarUnpack) porque lanza procesos auxiliares.
