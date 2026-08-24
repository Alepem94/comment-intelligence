'use client';

import { makeId } from '@ci/shared';
import type { AgentMessage, AgentStatusPayload, EventMessage, ExtractResult, RequestMessage } from '@ci/shared';
import type { CIErrorCode } from '@ci/shared';
import type { DiagnosticInfo, ProgressInfo } from '@ci/shared';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'busy' | 'error';

export interface StoredAgentConfig {
  port: number;
  token: string;
}

const LS_KEY = 'ci.agent.config.v1';

export function loadStoredConfig(): StoredAgentConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as StoredAgentConfig;
    if (cfg && typeof cfg.port === 'number' && typeof cfg.token === 'string') return cfg;
  } catch {}
  return null;
}

export function saveConfig(cfg: StoredAgentConfig): void {
  window.localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

export class CIRequestError extends Error {
  code: CIErrorCode;
  constructor(code: CIErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface Pending {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class AgentClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;

  state: ConnectionState = 'disconnected';
  status: AgentStatusPayload | null = null;
  config: StoredAgentConfig | null = null;
  lastError: string | null = null;

  onStateChange: ((s: ConnectionState) => void) | null = null;
  onProgress: ((p: ProgressInfo) => void) | null = null;

  private setState(s: ConnectionState): void {
    this.state = s === 'connected' && this.status?.state === 'BUSY' ? 'busy' : s;
    this.onStateChange?.(this.state);
  }

  private emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  subscribe(event: 'progress' | 'state', fn: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set?.delete(fn);
  }

  avatarProxyUrl(url: string): string {
    if (!this.config || this.state !== 'connected' && this.state !== 'busy') return url;
    return `http://127.0.0.1:${this.config.port}/ci/avatar-proxy?url=${encodeURIComponent(url)}&token=${encodeURIComponent(this.config.token)}`;
  }

  async pair(port: number, pairingCode: string): Promise<StoredAgentConfig> {
    const res = await fetch(`http://127.0.0.1:${port}/ci/status`).catch(() => null);
    if (!res || !res.ok) throw new Error('No se encontr\u00f3 el agente en el puerto ' + port);
    const tokenReq = await fetch(
      `http://127.0.0.1:${port}/ci/pair?code=${encodeURIComponent(pairingCode.trim().toUpperCase())}`
    ).catch(() => null);
    if (!tokenReq || tokenReq.status !== 200) throw new Error('C\u00f3digo de emparejamiento incorrecto.');
    const body = (await tokenReq.json()) as { token: string };
    const cfg: StoredAgentConfig = { port, token: body.token };
    saveConfig(cfg);
    this.config = cfg;
    return cfg;
  }

  connect(): void {
    if (typeof window === 'undefined') return;
    const cfg = this.config ?? loadStoredConfig();
    if (!cfg) {
      this.setState('error');
      this.lastError = 'Sin configuraci\u00f3n de agente';
      return;
    }
    this.config = cfg;
    this.closedByUser = false;
    this.setState('connecting');
    const ws = new WebSocket(`ws://127.0.0.1:${cfg.port}/ci/ws?token=${encodeURIComponent(cfg.token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.lastError = null;
      void this.request('status', undefined, 4000)
        .then((data) => {
          this.status = data as AgentStatusPayload;
          this.emit('state', this.status);
          this.setState('connected');
        })
        .catch(() => this.setState('connected'));
      this.startHeartbeat();
    };

    ws.onmessage = (ev) => {
      let msg: AgentMessage;
      try {
        msg = JSON.parse(ev.data as string) as AgentMessage;
      } catch {
        return;
      }
      if (msg.type === 'response') {
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.data);
        else {
          const err = msg.error ?? { code: 'INTERNAL' as CIErrorCode, message: 'Error desconocido del agente' };
          p.reject(new CIRequestError(err.code, err.message));
        }
      } else if (msg.type === 'event') {
        const em = msg as EventMessage;
        if (em.event === 'progress') {
          this.onProgress?.(em.payload as ProgressInfo);
          this.emit('progress', em.payload);
        } else if (em.event === 'state') {
          this.status = em.payload as AgentStatusPayload;
          this.emit('state', this.status);
          if (this.state === 'connected' || this.state === 'busy') this.setState('connected');
        }
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new CIRequestError('AGENT_NOT_CONNECTED', humanFallback('AGENT_NOT_CONNECTED')));
      }
      this.pending.clear();
      if (this.closedByUser) {
        this.setState('disconnected');
        return;
      }
      this.setState('connecting');
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      this.lastError = 'No se pudo conectar con el agente local.';
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.request('ping', undefined, 5000).catch(() => {});
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  request<T>(action: RequestMessage['action'], payload?: unknown, timeoutMs = 300000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new CIRequestError('AGENT_NOT_CONNECTED', humanFallback('AGENT_NOT_CONNECTED')));
        return;
      }
      const id = makeId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new CIRequestError('EXTRACTION_TIMEOUT', humanFallback('EXTRACTION_TIMEOUT')));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (d) => resolve(d as T),
        reject,
        timer
      });
      this.ws.send(JSON.stringify({ v: 1, id, type: 'request', action, payload }));
    });
  }

  extract(opts: { url: string; platform: string; limit: number; includeReplies: boolean }): Promise<ExtractResult> {
    this.setState('busy');
    return this.request<ExtractResult>('extract', opts).finally(() => this.setState('connected'));
  }

  stop(): Promise<void> {
    return this.request('stop', undefined, 5000) as Promise<void>;
  }

  diagnostic(platform: string): Promise<DiagnosticInfo> {
    return this.request<DiagnosticInfo>('diagnostic', { platform }, 15000);
  }

  openBrowser(platform: string): Promise<void> {
    return this.request('openBrowser', { platform }, 20000) as Promise<void>;
  }

  disconnect(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}

import { humanMessage } from '@ci/shared';
function humanFallback(code: CIErrorCode): string {
  try {
    return humanMessage(code);
  } catch {
    return 'Error del agente local.';
  }
}

let singleton: AgentClient | null = null;
export function getAgentClient(): AgentClient {
  if (!singleton) singleton = new AgentClient();
  return singleton;
}
