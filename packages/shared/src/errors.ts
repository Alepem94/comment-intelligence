export type CIErrorCode =
  | 'AGENT_NOT_CONNECTED'
  | 'PLATFORM_NOT_SUPPORTED'
  | 'NOT_LOGGED_IN'
  | 'POST_NOT_FOUND'
  | 'COMMENT_CONTAINER_NOT_FOUND'
  | 'COMMENTS_NOT_LOADED'
  | 'SCRAPING_BLOCKED'
  | 'DOM_CHANGED'
  | 'NO_COMMENTS_FOUND'
  | 'EXTRACTION_TIMEOUT'
  | 'EXPORT_FAILED'
  | 'AVATAR_LOAD_FAILED'
  | 'BROWSER_ERROR'
  | 'INVALID_URL'
  | 'UNAUTHORIZED'
  | 'INTERNAL';

export const CI_ERROR_MESSAGES_ES: Record<CIErrorCode, string> = {
  AGENT_NOT_CONNECTED: 'No pudimos conectarnos con el agente local. Abre la aplicaci\u00f3n Comment Intelligence en tu computadora y verifica que diga "Agente conectado".',
  PLATFORM_NOT_SUPPORTED: 'Esta plataforma no est\u00e1 soportada. Usa un enlace de Instagram, Facebook o TikTok.',
  NOT_LOGGED_IN: 'Abrimos una ventana del navegador para que inicies sesi\u00f3n en la plataforma (solo pasa una vez). Cuando termines, vuelve a pulsar Extraer.',
  POST_NOT_FOUND: 'No pudimos encontrar la publicaci\u00f3n. Verifica que el enlace sea correcto y que la publicaci\u00f3n sea p\u00fablica para tu cuenta.',
  COMMENT_CONTAINER_NOT_FOUND: 'No pudimos encontrar el panel de comentarios. Recarga la publicaci\u00f3n e int\u00e9ntalo nuevamente.',
  COMMENTS_NOT_LOADED: 'Los comentarios no terminaron de cargar. Revisa tu conexi\u00f3n e int\u00e9ntalo nuevamente.',
  SCRAPING_BLOCKED: 'La plataforma bloque\u00f3 la extracci\u00f3n temporalmente. Espera unos minutos antes de reintentar.',
  DOM_CHANGED: 'La plataforma cambi\u00f3 su estructura y no pudimos leer los comentarios. Reporta este error para actualizar el soporte.',
  NO_COMMENTS_FOUND: 'No encontramos comentarios en esta publicaci\u00f3n.',
  EXTRACTION_TIMEOUT: 'La extracci\u00f3n tard\u00f3 demasiado y se detuvo. Intenta con menos comentarios o reintenta.',
  EXPORT_FAILED: 'La exportaci\u00f3n fall\u00f3. Int\u00e9ntalo nuevamente con una selecci\u00f3n menor.',
  AVATAR_LOAD_FAILED: 'No pudimos cargar la foto de perfil; se usar\u00e1n iniciales.',
  BROWSER_ERROR: 'El navegador local no pudo abrirse. Verifica que Chrome o Edge est\u00e9n instalados.',
  INVALID_URL: 'El enlace no es v\u00e1lido. Copia la URL directamente desde la plataforma.',
  UNAUTHORIZED: 'C\u00f3digo de emparejamiento incorrecto. Revisa el c\u00f3digo mostrado en la ventana del agente.',
  INTERNAL: 'Ocurri\u00f3 un error inesperado en el agente local.'
};

export class CIError extends Error {
  code: CIErrorCode;
  detail?: string;
  constructor(code: CIErrorCode, detail?: string) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

export function humanMessage(code: CIErrorCode): string {
  return CI_ERROR_MESSAGES_ES[code] ?? CI_ERROR_MESSAGES_ES.INTERNAL;
}
