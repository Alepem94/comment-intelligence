# Decisiones de arquitectura

## 1. Web en Vercel + agente local obligatorio

El scraping se ejecuta **solo** en la computadora del usuario, dentro de un navegador real con su sesión. Vercel nunca toca las plataformas: evita bloqueos por IP de datacenter y mantiene las credenciales del lado del usuario. Alternativa descartada: scraping server-side (bloqueos masivos, riesgo legal/ToS).

## 2. Comunicación web ↔ agente

- HTTP local (`127.0.0.1:8765`) para `status`, `pair` y proxy de avatares.
- WebSocket para comandos (extract/stop/diagnostic) y eventos de progreso.
- Protocolo tipado en `@ci/shared` con `v:1`, ids de correlación, timeout y errores con código.

Alternativas descartadas:
- SSE: no permite comandos del cliente de forma natural.
- Solo HTTP polling: peor latencia para progreso en vivo.

## 3. Seguridad local

- El agente genera un token aleatorio persistente (`~/.comment-intelligence/agent-token.json`, chmod 600).
- La web lo obtiene mediante un **código de emparejamiento** de 6 caracteres mostrado en la ventana del agente (`GET /ci/pair?code=`). Sin el código, un sitio malicioso no puede manejar el navegador.
- CORS abierto solo en `/ci/status` (sin datos sensibles) y `/ci/pair` (protegido por código).
- El servidor escucha únicamente en `127.0.0.1`.

## 4. Sesiones

Perfiles persistentes de Chromium por plataforma (`~/.comment-intelligence/profiles/<plataforma>`). El usuario inicia sesión una vez dentro del navegador que abre el agente; la cookie vive solo ahí. Nunca pedimos credenciales en la web app.

## 5. Playwright y empaquetado del agente

Elección: **Electron** (tray/menubar) + `playwright-core`.

- Electron trae Node embebido → cero requisitos para el usuario final (sin terminal, sin npm).
- `playwright-core` + detección de canal: usa **Chrome o Edge instalado** (Edge viene con Windows/macOS actualizados). Fallback: Chromium descargable vía menú "Instalar navegador runtime" (`npx playwright install chromium`).
- electron-builder genera NSIS (Windows) y DMG (macOS). Los binarios de navegador NO se incluyen (peso/licencias); se documenta el requisito.

Alternativas descartadas:
- Tauri: no incluye runtime Node; habría que compilar sidecars por SO para Playwright.
- pkg/nexe: empaquetado frágil con Playwright (binarios y rutas dinámicas).

### 5.1 Navegador real adjunto por CDP (decisión posterior a la primera validación)

Lanzar el navegador DESDE Playwright deja `navigator.webdriver = true` y banderas de automatización → Instagram mete en bucle de captcha al intentar loguearse. Solución implementada en `apps/agent/src/browser.ts`:

1. El agente **ejecuta tu Chrome/Edge real como proceso normal** (`--remote-debugging-port=9235/9236/9237`, un puerto fijo por plataforma) con perfil persistente propio.
2. Se conecta vía `chromium.connectOverCDP('http://127.0.0.1:<puerto>')`.
3. Resultado: fingerprint de navegador 100% humano (login y captchas se resuelven una vez), sesiones persistentes, y el agente conserva control total (goto/evaluate/scroll) para el scraping.
4. Si el navegador ya está abierto con ese perfil, se reconecta en lugar de lanzar otro. Antes de relanzar limpia procesos huérfanos del mismo perfil.
5. Fallback automático al método anterior (launchPersistentContext) si no hay Chrome/Edge instalados.

Prueba automatizada: `apps/agent/scripts/smoke.ts` (adjunta, navega, evalúa y cierra).

## 6. Arquitectura de adapters

`PlatformAdapter` (en `scraper-core`) define 4 funciones **autocontenidas** que corren DENTRO de la página:

- `pageProbe()` — estado de página/login/contenedor
- `pageExtract()` — extrae comentarios del DOM actual
- `pageScrollStep()` — detecta el contenedor scrollable correcto y hace scroll
- `pageOpenReplies()` — abre respuestas colapsadas

Son funciones sin closures externas: se serializan con `.toString()` y se ejecutan vía `page.evaluate(...)`. Esa misma autocontención permite testearlas en happy-dom con fixtures HTML y validarlas con `eval` (garantiza que no dependan de nada externo).

El motor genérico `runHarvest()` (Node) orquesta: goto → probe/settle → loop {extract → dedupe → progreso → abrir respuestas → scroll} → paradas por límite/stall/stop/timeout. Un adapter roto no afecta a los demás.

## 7. Estrategia de extracción por plataforma (honestidad técnica)

Los selectores exactos cambian constantemente. Por eso cada adapter combina:

- **Instagram**: `ul li` con anchor de perfil propio; texto desde el contenedor de fila excluyendo autor/meta; `time[datetime]`; likes por `aria-label`/texto; replies por anidamiento `ul ul li`.
- **Facebook**: permalinks reales `a[href*="comment_id="]` (dan IDs estables); climb controlado hasta el bloque que contiene autor+texto; texto = bloque `dir=auto` previo al permalink; replies por `reply_comment_id`.
- **TikTok**: `data-e2e="comment-item|comment-reply-item"` y fallbacks estructurales; likes con sufijos K/M/mil; expanders de respuestas.

Ninguno fue validado contra producción todavía (ver estado arriba). Cuando una plataforma cambie su DOM, se repara SOLO su adapter y sus fixtures.

## 8. Deduplicación

Clave primaria: `comment_id` si existe (Facebook). Si no, fingerprint `platform ⊞ username ⊞ text-normalizado ⊞ timestamp`. El merge enriquece con datos nuevos (likes/ids que llegaron después). Esto sobrevive a rerenders, virtualización y MutationObservers.

## 9. Exportaciones

- CSV: implementación propia en `@ci/shared` (escapado RFC, BOM UTF-8 para Excel, saltos de línea y emojis).
- JPG/PNG: html2canvas `scale: 3` sobre tarjetas HTML/CSS recreadas (no capturas del sitio). Avatares resueltos por el proxy del agente para esquivar CORS cuando está conectado; fallback a iniciales.
- HTML: tablas con estilos inline (compatible email/docs), portapapeles con `text/html` + fallback.

## 10. Persistencia

Sin base de datos. Estado en React + IndexedDB (`extractions`) para el historial opcional local. La forma de los datos (`Comment`) ya es "tabla lista" para migrar a Postgres si algún día hace falta.
