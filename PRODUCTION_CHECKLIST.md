# Checklist de producción

Marca SOLO cuando esté validado contra la plataforma real, no en demo.

## Infraestructura
- [ ] Web desplegada en Vercel y accesible por HTTPS
- [ ] Repositorio GitHub conectado; deploy automático funcionando
- [ ] Instalador Windows `.exe` generado y probado en una máquina limpia
- [ ] Instalador macOS `.dmg` generado y probado en una Mac limpia

## Agente
- [ ] Agente instala sin errores (Windows + macOS)
- [ ] Ventana/tray muestra estado y código de emparejamiento
- [ ] Web muestra "Agente conectado" tras emparejar
- [ ] Reconexión funciona (matar/redir agente → reconecta solo)
- [ ] "Abrir navegador" abre la plataforma con perfil persistente
- [ ] Sesión persiste tras cerrar/abrir el agente

## Instagram
- [ ] Detecta reel y post
- [ ] NOT_LOGGED_IN se informa correctamente sin sesión
- [ ] Extracción de comentarios reales OK
- [ ] Respuestas incluidas marcadas como respuesta
- [ ] Scroll carga más comentarios hasta el límite pedido
- [ ] Deduplicación estable en extracción larga (>1000)

## Facebook
- [ ] Publicaciones y videos detectados
- [ ] comment_id estable extraído
- [ ] Replies mapeadas a su comentario padre
- [ ] Likes/reacciones cuando están disponibles
- [ ] Scroll + dedupe OK

## TikTok
- [ ] Video detectado, panel de comentarios localizado
- [ ] Expansión de respuestas ("ver N respuestas")
- [ ] Likes con sufijos K/M parseados correctamente
- [ ] Scroll + dedupe OK

## Producto
- [ ] Tabla fluida con >2000 comentarios (virtualización)
- [ ] Búsqueda, filtros (likes/tipo/plataforma/selección), orden
- [ ] CSV correcto: emojis, acentos, saltos de línea, BOM Excel
- [ ] JPG/PNG nítidos (scale 3) para IG/FB/TikTok
- [ ] Copiar HTML pega con estilo en email/documento
- [ ] Historial IndexedDB guarda/carga/limpia
- [ ] Modo diagnóstico refleja el estado real de la página viva
- [ ] Errores muestran mensajes humanos (no técnicos)
- [ ] Botón Detener corta la extracción a tiempo

## Documentación
- [ ] TEAM_GUIDE entregada al equipo
- [ ] TROUBLESHOOTING actualizado con casos reales encontrados
- [ ] PROJECT_STATUS.md actualizado con resultados de validación
