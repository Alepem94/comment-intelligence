# CONTINUE_PROMPT

Copia este prompt completo en la siguiente IA/sesión:

---

Estás CONTINUANDO un proyecto existente llamado **Comment Intelligence**. NO empieces de cero. Lee primero `PROJECT_STATUS.md`, `HANDOFF.md` y `ARCHITECTURE_DECISIONS.md` en la raíz; contienen el estado real y verificado.

## Qué es

Herramienta para extraer comentarios REALES de Instagram, Facebook y TikTok: web app (Next.js estático, desplegada en Vercel) + agente local (Electron/Node/TS + Playwright) que controla el navegador del usuario con SU sesión. Monorepo npm workspaces en `apps/web`, `apps/agent`, `packages/shared`, `packages/scraper-core`.

## Reglas inviolables (del brief original)

- Scraping 100% real desde el navegador local. PROHIBIDO mock data, Apify o servicios externos.
- PROHIBIDO Supabase/Firebase/base de datos.
- Nunca enviar credenciales/cookies/sesiones al servidor web.
- Si algo no se validó contra la plataforma real, declararlo "IMPLEMENTADO PERO NO VALIDADO CONTRA LA PLATAFORMA REAL". No inventes resultados.

## Arquitectura (ya implementada)

- Web ↔ Agente: WebSocket `ws://127.0.0.1:8765/ci/ws?token=...` + HTTP `/ci/status`, `/ci/pair?code=` (emparejamiento por código de 6 chars), `/ci/avatar-proxy`. Protocolo tipado en `packages/shared/src/protocol.ts`.
- Agente: perfiles persistentes Playwright por plataforma (`~/.comment-intelligence/profiles`), canales chrome→msedge→chromium. Servidor en `apps/agent/src/server.ts`; navegador en `browser.ts`; runner en `harvestRunner.ts`; shell Electron tray en `electron/main.ts` (build con `build.mjs` → esbuild CJS).
- Scraping: adapters autocontenidos (`pageProbe/pageExtract/pageScrollStep/pageOpenReplies`) que se serializan con `.toString()` y corren vía `page.evaluate`. Motor genérico `runHarvest()` (scroll→extract→dedupe→progreso; paradas por límite/stall/stop/timeout). Dedupe por comment_id o fingerprint (platform+user+texto normalizado+timestamp) en `@ci/shared/dedupe`.

## Estado verificado (no lo rehagas)

- 41 tests vitest passing (shared 23, scraper-core 15 con fixtures happy-dom + test de autocontención serializada, agent 3). Lint 0 errores. Build web OK (static export), build agente OK. Smoke test del agente OK (sirve /ci/status, imprime código).
- UI completa: tabla virtualizada, filtros/búsqueda/orden/selección, progreso en vivo con Detener, detalle lateral, tarjetas IG/FB/TikTok, CSV BOM UTF-8, JPG/PNG scale 3 individual y por lotes, HTML autocontenido, historial IndexedDB, diagnóstico, errores humanos.

## Falta (trabaja SOLO aquí)

1. **TIKTOK (90% diagnosticado — implementar ya)**:
   - CONFIRMADO en vivo (scripts/diag-tt.ts): tras hidratar (~30s), clic en `[data-e2e="comment-icon"]` (índice 0) abre el panel. El panel NO usa data-e2e: usa CLASSES `DivCommentListContainer` (contenedor scrollable), `DivCommentItemWrapper` (cada comentario), `DivCommentContentWrapper`, `DivCommentHeaderWrapper`, `DivCommentSubContentSplit`, `DivCommentCountContainer`.
   - IMPLEMENTAR en `packages/scraper-core/src/adapters/tiktok.ts`: (a) nuevo `pageOpenComments()` que haga click en `[data-e2e="comment-icon"]` (agregar `pageOpenComments?(): number` a Adapter en base.ts y llamarlo en el settle loop de harvest.ts cuando commentContainerDetected=false); (b) pageProbe: container = existe `[class*="DivCommentListContainer"]`, commentsInDom = count `[class*="DivCommentItemWrapper"]`; (c) pageExtract: items=`[class*="DivCommentItemWrapper"]`, username=primer `a[href^="/@"]` (href slice 1), texto=textContent de `[class*="DivCommentContentWrapper"]` menos username, likes=parseCount de `[class*="DivCommentCountContainer"]` o span numérico, time=leaf corto tipo "hace 4 d"/"4-12"; (d) pageScrollStep: scroll de DivCommentListContainer.
   - Validar en vivo con `npx tsx scripts/test-loadmore.ts "<URL tiktok>" 50` (adaptarlo a tiktok: usa adapter tiktok y puerto 9237). Luego fixture+tests, `npm run package:win`, instalador, validar con la web.
2. **Facebook**: validar igual (login en navegador del agente, URL share/p o /posts/, diag con `scripts/diag-rows.ts` adaptado). Adapter ya tiene pageLoadMore para "Ver más comentarios".
3. Respuestas anidadas IG: verificar expansión en post con muchas ("Ver las N respuestas" con svg — pageOpenReplies ya maneja svg-only; confirmar en vivo).

## Comandos

```bash
npm install
npm test && npm run lint && npm run build
npm run dev:agent    # terminal 1 (imprime código de emparejamiento)
npm run dev:web      # terminal 2 → http://localhost:3000
cd apps/agent && npm run electron:dev   # tray version
```

## Al terminar tu sesión

Actualiza `PROJECT_STATUS.md`, `HANDOFF.md` y este prompt con lo hecho/faltante/bugs, ejecuta `npm test` y deja todo guardado. No marques nada como terminado sin validarlo realmente.
