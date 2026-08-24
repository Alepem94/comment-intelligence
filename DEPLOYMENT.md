# Guía de despliegue

Paso a paso, sin asumir conocimientos previos.

## Parte A — Subir la web app (Vercel)

### A1. Crear el repositorio de GitHub

1. Entra a <https://github.com/new>.
2. Nombre: `comment-intelligence`. Visibilidad: **Private**.
3. NO marques "Add a README" (ya existe). Crea el repo vacío.
4. En tu computadora, dentro de la carpeta del proyecto:

```powershell
git init
git add .
git commit -m "Comment Intelligence v0.1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/comment-intelligence.git
git push -u origin main
```

### A2. Conectar Vercel

1. Entra a <https://vercel.com/new> con tu cuenta de GitHub.
2. Importa el repositorio `comment-intelligence`.
3. Configura:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js (autodetectado)
   - **Build Command**: `npm run build` (por defecto)
   - **Output Directory**: `.next` (Vercel detecta el export estático)
   - Variables de entorno: ninguna obligatoria. Opcionalmente `NEXT_PUBLIC_AGENT_URL=http://127.0.0.1:8765`.
4. Pulsa **Deploy**. Al terminar tendrás algo como `https://comment-intelligence.vercel.app`.

> El build produce un sitio estático (`output: 'export'`): la web no ejecuta código de servidor.

## Parte B — Compilar y distribuir el agente (Windows)

Requisitos en la máquina de build: Windows + Node.js 20+.

```powershell
cd comment-intelligence\apps\agent
npm install            # en la raíz si es la primera vez
set ELECTRON_SKIP_BINARY_DOWNLOAD=
npm run package:win
```

Resultado: `apps\agent\release\Comment Intelligence Agent Setup 0.1.0.exe`

Distribución: súbelo a Google Drive/Dropbox/SharePoint del equipo y comparte el enlace junto con `TEAM_GUIDE.md`.

> El instalador NO incluye Chrome/Edge (ya vienen con Windows) ni Chromium. Si alguien no tiene ninguno, el agente ofrece descargar el runtime desde su menú.

## Parte C — Compilar y distribuir el agente (macOS)

Requisitos: una Mac con Node.js 20+ (el instalador NSIS no se puede generar en Mac ni viceversa; cada SO genera su propio instalador).

```bash
cd comment-intelligence/apps/agent
npm install
npm run package:mac
```

Resultado: `apps/agent/release/Comment Intelligence Agent 0.1.0.dmg`

Notas macOS:
- La primera ejecución puede pedir permisos (Gatekeeper): clic derecho → Abrir.
- Para firmar/notarizar oficialmente se necesitan credenciales Apple Developer ($99/año). Sin firma, los usuarios verán el aviso de "app sin identificar".

## Parte D — Probar producción de punta a punta

1. Abre la URL de Vercel.
2. Instala y abre el agente. Copia el **código de emparejamiento**.
3. Pega el código en la web → debe aparecer "● Agente conectado".
4. Botón "Abrir navegador" → inicia sesión en Instagram/Facebook/TikTok.
5. Pega una URL real → Extraer → verifica que llegan comentarios REALES.
6. Prueba: búsqueda, filtros, selección, CSV, JPG, PNG, HTML, historial.
7. Marca los resultados en `PRODUCTION_CHECKLIST.md`.

## Variables de entorno

Ninguna es obligatoria. Ver `.env.example`.

| Variable | Dónde | Default |
|---|---|---|
| `CI_AGENT_PORT` | agente | `8765` |
| `CI_AGENT_DATA_DIR` | agente | `~/.comment-intelligence` |
