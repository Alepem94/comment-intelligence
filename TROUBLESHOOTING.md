# Solución de problemas

## Agente no conectado

1. Verifica que el agente esté abierto (icono en la barra de tareas/menú).
2. Cierra y vuelve a abrir el agente; pega el código nuevo en la web.
3. Puerto ocupado: cierra otras apps o cambia el puerto con la variable `CI_AGENT_PORT` (avanzado).
4. Antivirus/firewall: permite conexiones locales del agente.

## El navegador no abre

- Necesitas Chrome o Edge instalados (Edge viene con Windows). Si no tienes ninguno, usa la opción del agente para descargar el navegador.
- Windows: si aparece "falta VCRUNTIME", instala Microsoft Visual C++ Redistributable x64.

## Instagram / Facebook / TikTok no detectado o POST_NOT_FOUND

- Abre primero el navegador del agente e inicia sesión en esa red social.
- Recarga la publicación dentro del navegador del agente y reintenta.
- Cuentas privadas: solo se pueden extraer comentarios visibles para tu cuenta.
- Stories y publicaciones sin panel de comentarios: no soportadas.

## Captcha en bucle al iniciar sesión

Resuelto desde v0.1.0: el agente ya no lanza un "navegador automatizado" sino tu Chrome/Edge real adjuntándose por el puerto de depuración, por lo que el login se ve normal y el captcha se resuelve una sola vez.

Si aun así ves bucle:
1. Cierra TODAS las ventanas del navegador del agente.
2. Cierra y reabre el agente.
3. Si persiste, borra el perfil: `~\.comment-intelligence\profiles\<plataforma>` y vuelve a iniciar sesión.
4. Prueba con otra red (Facebook/TikTok) o espera unos minutos: a veces es rate-limit temporal de la plataforma.

## COMMENTS_NOT_LOADED / pocos comentarios

- Las plataformas cargan comentarios con scroll infinito: espera; el contador avanza solo.
- Si se detiene antes de tiempo, pulsa Extraer de nuevo: los duplicados ya conocidos se saltan.
- Reduce la cantidad objetivo (100/500) en publicaciones enormes.

## Comentarios duplicados

No deberían aparecer (hay deduplicación por ID/fingerprint). Si ves duplicados reales, reporta el caso: probablemente cambió el DOM de la plataforma.

## DOM_CHANGED

La plataforma cambió su estructura. Reporta el error con la plataforma y fecha; hay que actualizar ese adapter. Mientras tanto las demás plataformas siguen funcionando.

## Avatar no aparece

Se muestran iniciales cuando la imagen no puede cargarse (CORS/privacidad). No afecta a los datos ni al CSV.

## JPG/PNG falla

- EXPORT_FAILED: reintenta con menos comentarios seleccionados a la vez.
- Si el agente está conectado, los avatares pasan por su proxy local: verifica conexión.

## Problemas macOS

- "App dañada/no identificada": clic derecho sobre la app → Abrir → Abrir.
- Permisos de red: Aceptar cuando el sistema pregunte.

## Problemas Windows

- SmartScreen al instalar: "Más información" → "Ejecutar de todas formas".
- Reinstalación completa:
  1. Desinstala "Comment Intelligence Agent" desde Configuración → Aplicaciones.
  2. Borra la carpeta `C:\Users\TU_USUARIO\.comment-intelligence`.
  3. Instala de nuevo. (Esto también borra sesiones guardadas: tendrás que iniciar sesión otra vez.)

## Reinicio del agente (sin desinstalar)

Cierra el agente desde su menú (Salir), bóralo de la barra, y ábrelo otra vez. El código de emparejamiento cambia: actualízalo en la web si te lo pide.
