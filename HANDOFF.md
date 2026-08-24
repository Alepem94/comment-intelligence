# HANDOFF (para otra IA)

## 1. Qué estamos construyendo

**Comment Intelligence**: herramienta web + agente local para extraer comentarios REALES de Instagram, Facebook y TikTok. El usuario pega una URL en la web (Vercel); un agente instalado en SU computadora abre esa URL en un navegador real con su propia sesión (Playwright, perfil persistente), hace scroll, extrae comentarios con deduplicación y los devuelve a la tabla web para filtrar/seleccionar y exportar CSV / JPG / PNG / HTML.

## 2. Objetivo no negociable

Scraping 100% real desde el navegador del usuario. PROHIBIDO: mocks, Apify/servicios externos, Supabase/Firebase/DB, robar sesiones, evadir auth. Si algo no está validado contra la plataforma real, se declara "IMPLEMENTADO PERO NO VALIDADO CONTRA LA PLATAFORMA REAL".

## 3. Arquitectura

```
Vercel (Next.js static export)
   │ ws://127.0.0.1:8765/ci/ws?token=...
Local Agent (Electron tray; CLI en dev) — HTTP+WS local
   │ Playwright persistent contexts (~/.comment-intelligence/profiles/<platform>)
Chrome/Edge/Chromium → instagram.com | facebook.com | tiktok.com
```

Protocolo: mensajes JSON `{v:1,id,type:'request'|'response'|'event',...}` definidos en `packages/shared/src/protocol.ts`. Auth: token persistente obtenido vía código de emparejamiento de 6 chars (`GET /ci/pair?code=`). Heartbeat ping cada 10 s, reconexión automática del cliente.

## 4. Tecnologías

- Web: Next.js 14 (`output:'export'`), React 18, Tailwind, html2canvas(scale 3), IndexedDB propio.
- Agente: Node TS, `ws`, `playwright-core` (canales chrome→msedge→chromium), Electron + electron-builder.
- Tests: vitest + happy-dom (fixtures HTML reales en packages/scraper-core/fixtures).
- Monorepo: npm workspaces. Paquetes internos se consumen como fuente TS (`"main":"./src/index.ts"`, `"type":"module"`); el agente los empaqueta con esbuild.

## 5. Estructura real (resumen)

```
apps/web/src/{app/page.tsx, lib/(agentClient|store|idb|exportCsv|imageExport|selfContainedHtml).ts, components/*}
apps/agent/{src/(index|server|browser|harvestRunner|tokens|config).ts, electron/(main|preload).ts, ui.html,
            build.mjs, electron-builder.yml}
packages/shared/src/{types,errors,urls,dedupe,csv,protocol,index}.ts + test/
packages/scraper-core/src/{adapters/(instagram|facebook|tiktok|base|index).ts, harvest.ts, map.ts} +
fixtures/*.html + test/
Raíz: README, DEPLOYMENT, DEVELOPMENT, TEAM_GUIDE, TROUBLESHOOTING, PRODUCTION_CHECKLIST,
PROJECT_STATUS, ARCHITECTURE_DECISIONS, HANDOFF, CONTINUE_PROMPT, eslint.config.mjs
```

## 6. Implementado (verificado con build/tests/lint)

- Todo lo listado en `PROJECT_STATUS.md → Terminado`.
- Smoke test ejecutado: agente arranca, sirve `/ci/status`, imprime código de emparejamiento.

## 7. Parcial

- Instaladores: configuración lista, NO generados aún (requiere Windows/macOS reales).

## 8. Falta

1. Validación real por plataforma + ajuste fino de selectores (checklist en PRODUCTION_CHECKLIST.md).
2. `npm run package:win` / `package:mac` en sus SO y prueba de instalación limpia.
3. Opcional: botón "Instalar navegador runtime" cableado a `npx playwright install chromium`.

## 9. Bugs

- Ninguno abierto. Riesgo permanente: cambios de DOM de plataformas (por eso adapters aislados + fixtures).

## 10-11. Último trabajo y próxima tarea

Último: lint limpio, protocol.ts refactor, smoke test del agente OK.
Próxima tarea recomendada: **validación real de Instagram** siguiendo PRODUCTION_CHECKLIST (abrir reel real vía agente, modo diagnóstico, corregir adapter si hace falta, registrar resultado).

## 12-14. Ejecutar/probar

```bash
npm install
npm test          # 41 tests
npm run lint      # 0 errores
npm run build     # web static + agent bundles
npm run dev:agent # consola muestra puerto 8765 + código emparejamiento
npm run dev:web   # http://localhost:3000 → pegar código → usar
cd apps/agent && npm run electron:dev  # versión con ventana/tray
```

Estado tests: 41 passing / 0 failing (vitest, 3 workspaces).

## 15. Limitaciones

- Sin validación contra plataformas reales todavía (declarado en README/PROJECT_STATUS).
- Campos no disponibles van `null` (p.ej. comment_id en IG/TikTok → dedupe por fingerprint).
- Avatares pueden caer a iniciales por CORS si el agente no está conectado.
- macOS sin firmar muestra Gatekeeper; documentado en TROUBLESHOOTING.
