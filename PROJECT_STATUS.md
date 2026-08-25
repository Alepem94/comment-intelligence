# Estado del proyecto

Actualizado: 2026-08-24

## Fase actual y progreso

**Fase 1–4 completadas en código; Fase 5 completa salvo validación real.**
Progreso aproximado de construcción: **95%** (falta validar contra plataformas reales y generar instaladores en SO destino).

## Terminado

- Monorepo npm workspaces (apps/web, apps/agent, packages/shared, packages/scraper-core)
- Web app Next.js export estático: conexión por código, extracción con progreso en vivo,
  tabla virtualizada, búsqueda/filtros/orden/selección, detalle lateral, tarjetas IG/FB/TikTok,
  CSV (BOM UTF-8), JPG/PNG scale 3 (individual y por lotes), HTML autocontenido al portapapeles,
  historial IndexedDB, modo diagnóstico, mensajes de error humanos,
  botones directos "Iniciar sesión" por plataforma en la barra superior
- Agente local: HTTP+WS en 127.0.0.1:8765, emparejamiento por código, token persistente chmod600,
  **navegador real (Chrome/Edge) adjunto por CDP con perfiles persistentes** — resuelve el bucle
  de captcha del login —, avatar-proxy anti-CORS, stop/timeout/stall detection,
  shell Electron tray/menubar + ventana de estado
- Motor genérico `runHarvest` + adapters IG/FB/TikTok autocontenidos (serializables a page.evaluate)
- Smoke test del navegador real: `apps/agent/scripts/smoke.ts` (SMOKE_OK verificado en Windows)
- Tests: 41 passing; lint limpio; builds web+agente OK

## Parcialmente terminado

- Empaquetado instaladores: config electron-builder lista; falta EJECUTAR package:win (Windows) y package:mac (macOS) en sus SO destino.

## Falta / siguiente tarea

1. Validar Instagram/Facebook/TikTok contra la realidad (ver PRODUCTION_CHECKLIST) y ajustar selectores.
2. Generar instaladores y probar instalación limpia.
3. (Opcional) Menú "Instalar navegador runtime" del Electron: hoy vía CLI playwright; cablear botón.

## Estado por plataforma

| Plataforma | Adapter | Tests fixtures | Validado en producción |
|---|---|---|---|
| Instagram | ✅ v2 (DOM real: sin article/time, filas por hoja "Responder") | ✅ 4 casos | ✅ **VALIDADO 2026-08-24**: 44 comentarios reales (15→44 con auto-click del botón ⊕ "cargar más"), scroll+dedupe OK |
| Facebook | ✅ implementado (comment_id estable) | ✅ 3 casos | ❌ NO VALIDADO CONTRA LA PLATAFORMA REAL |
| TikTok | ⚠️ en calibración — HALLAZGOS 2026-08-24: (1) el video abre en visor feed y el panel de comentarios NO carga solo: hay que hacer clic en `[data-e2e="comment-icon"]`; (2) la SPA tarda en hidratar (esperar `[data-e2e="comment-list"]` hasta 30s); (3) sin login-modal detectado con sesión. SIGUIENTE PASO: tras el clic, muestrear anatomía de items (diag-tt.ts ya lo hace) y ajustar pageExtract/pageProbe + agregar pageOpenComments al Adapter/motor. | ✅ 3 casos (fixture viejo) | ❌ NO VALIDADO |

Notas de validación Instagram:
- URLs /reel/ y /reels/ se normalizan a /p/<code>/ (el visor de feed no renderiza la lista de comentarios).
- Login del navegador del agente resuelto adjuntando Chrome real por CDP (sin webdriver).
- Pendiente menor: expansión de respuestas anidadas ("Ver las N respuestas") a verificar en post con respuestas abiertas.

## Bugs conocidos

- Ninguno abierto en código. Riesgo conocido: los DOM reales difieren de los fixtures; los adapters
  tienen heurísticas en capas pensadas para absorber cambios menores.

## Comandos

```bash
npm install && npm test && npm run lint && npm run build
npm run dev:agent   # + código de emparejamiento en consola
npm run dev:web     # http://localhost:3000
```
