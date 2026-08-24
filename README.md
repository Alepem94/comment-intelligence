# Comment Intelligence

Extracción de comentarios **reales** de Instagram, Facebook y TikTok usando un agente local que controla tu propio navegador. La sesión de cada red social nunca sale de tu computadora.

```
Vercel (web app Next.js)
        │  localhost / WebSocket
        ▼
Local Agent (Electron + Node/TS + Playwright)
        │  perfil persistente por plataforma
        ▼
Navegador local ──► Instagram / Facebook / TikTok
```

## Qué hace

1. Pegas la URL de un reel/video/publicación.
2. La app detecta la plataforma y verifica el agente.
3. El agente abre la publicación en un navegador local con tu sesión iniciada.
4. Hace scroll, carga comentarios y respuestas reales, deduplica y envía los resultados a la tabla.
5. Buscas, filtras, ordenas y seleccionas.
6. Exportas: CSV, JPG/PNG de alta resolución del comentario recreado, HTML autocontenido.

## Estado por plataforma

| Plataforma | Estado |
|---|---|
| Instagram | IMPLEMENTADO PERO NO VALIDADO CONTRA LA PLATAFORMA REAL |
| Facebook | IMPLEMENTADO PERO NO VALIDADO CONTRA LA PLATAFORMA REAL |
| TikTok | IMPLEMENTADO PERO NO VALIDADO CONTRA LA PLATAFORMA REAL |

Los tres adapters usan extracción real vía Playwright sobre el DOM vivo (sin mocks ni datos falsos). Los fixtures HTML solo se usan en tests unitarios. Como ningún paso se ejecutó contra las plataformas reales desde este entorno de desarrollo, así se declaran. Ver `PRODUCTION_CHECKLIST.md` para validarlos.

## Tecnologías

- **Web**: Next.js 14 (export estático), React 18, TypeScript, Tailwind, html2canvas
- **Agente**: Node.js + TypeScript, Playwright (Chrome/Edge local o Chromium), WebSocket (`ws`)
- **Empaquetado agente**: Electron + electron-builder (NSIS `.exe`, DMG)
- **Sin**: Supabase, Firebase, base de datos, servicios externos de scraping

## Estructura

```
apps/
  web/          Web app (Next.js, UI completa)
  agent/        Agente local (servidor WS+HTTP, Playwright, Electron tray)
packages/
  shared/       Tipos, errores, URLs, dedupe/fingerprint, CSV, protocolo
  scraper-core/ Adapters Instagram/Facebook/TikTok + motor de harvest
docs en raíz    README, DEPLOYMENT, DEVELOPMENT, TEAM_GUIDE, TROUBLESHOOTING...
```

## Desarrollo rápido

```bash
npm install
npm run dev:agent     # terminal 1: agente en http://127.0.0.1:8765
npm run dev:web       # terminal 2: web en http://localhost:3000
npm test              # tests (vitest)
npm run lint          # eslint
npm run build         # build de todos los workspaces
```

El agente imprime un **código de emparejamiento**; pégalo una sola vez en la web.

## Empaquetado del agente

```bash
cd apps/agent
npm run package:win   # release/Comment Intelligence Agent Setup x.y.z.exe  (requiere Windows)
npm run package:mac   # release/Comment Intelligence Agent x.y.z.dmg        (requiere macOS)
```

## Documentación

- `DEPLOYMENT.md` — GitHub + Vercel + compilación/distribución de instaladores
- `DEVELOPMENT.md` — arquitectura interna, debugging, cómo reparar un adapter
- `TEAM_GUIDE.md` — guía no técnica para el equipo de marketing
- `TROUBLESHOOTING.md` — problemas comunes y soluciones
- `PRODUCTION_CHECKLIST.md` — checklist de validación real
- `PROJECT_STATUS.md` / `ARCHITECTURE_DECISIONS.md` / `HANDOFF.md` / `CONTINUE_PROMPT.md`

## Privacidad

- Nunca se envían contraseñas, cookies, tokens ni sesiones al servidor web.
- Las sesiones viven en perfiles persistentes locales (`~/.comment-intelligence/profiles`).
- No existen mecanismos para evadir autenticación ni controles de plataforma.
