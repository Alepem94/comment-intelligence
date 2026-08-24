import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  CIError,
  detectPlatform,
  humanMessage,
  makeId,
  normalizePostUrl
} from '@ci/shared';
import type {
  AgentMessage,
  AgentStatusPayload,
  EventMessage,
  ExtractResult,
  ProgressInfo,
  RequestMessage,
  ResponseMessage
} from '@ci/shared';
import { AGENT_NAME, AGENT_VERSION, agentPort } from './config';
import type { AgentTokens } from './tokens';
import type { BrowserManager } from './browser';
import type { HarvestRunner } from './harvestRunner';

const AVATAR_HOSTS = [
  'cdninstagram.com',
  'instagram.com',
  'fbcdn.net',
  'facebook.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktok.com',
  'byteoversea.com'
];

export interface ServerDeps {
  tokens: AgentTokens;
  browsers: BrowserManager;
  runner: HarvestRunner;
  onStateChange?: (s: AgentStatusPayload) => void;
}

function isAvatarUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    return AVATAR_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function proxyAvatar(res: http.ServerResponse, rawUrl: string): Promise<void> {
  try {
    const u = new URL(rawUrl);
    const mod = await import('node:https');
    await new Promise<void>((resolve) => {
      const req = mod.get(u, (up) => {
        if (up.statusCode !== 200) {
          res.statusCode = 502;
          res.end();
          up.resume();
          return resolve();
        }
        res.setHeader('Content-Type', up.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        up.pipe(res);
        up.on('end', resolve);
      });
      req.setTimeout(10000, () => {
        req.destroy();
        res.statusCode = 504;
        res.end();
        resolve();
      });
      req.on('error', () => {
        res.statusCode = 502;
        res.end();
        resolve();
      });
    });
  } catch {
    res.statusCode = 400;
    res.end();
  }
}

export function createAgentServer(deps: ServerDeps): { start(): Promise<number>; broadcastEvent(e: EventMessage['event'], payload: unknown): void; status(): AgentStatusPayload; close(): Promise<void>; wss: WebSocketServer } {
  const server = http.createServer((req, res) => {
    void handleHttp(req, res);
  });
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  const authorized = (req: http.IncomingMessage): boolean => {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const q = url.searchParams.get('token') || '';
    return bearer === deps.tokens.token || q === deps.tokens.token;
  };

  async function handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/ci/status') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ name: AGENT_NAME, version: AGENT_VERSION }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/ci/pair') {
        const code = (url.searchParams.get('code') || '').trim().toUpperCase();
        if (code && code === deps.tokens.pairingCode) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ token: deps.tokens.token }));
        } else {
          res.statusCode = 401;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: humanMessage('UNAUTHORIZED') } }));
        }
        return;
      }
      if (!authorized(req)) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: humanMessage('UNAUTHORIZED') } }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/ci/avatar-proxy') {
        const target = url.searchParams.get('url') || '';
        if (!isAvatarUrl(target)) {
          res.statusCode = 400;
          res.end();
          return;
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        await proxyAvatar(res, target);
        return;
      }
      res.statusCode = 404;
      res.end();
    } catch {
      res.statusCode = 500;
      res.end();
    }
  }

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/ci/ws') {
      socket.destroy();
      return;
    }
    if ((url.searchParams.get('token') || '') !== deps.tokens.token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    ws.on('message', (data) => {
      void handleMessage(ws, data.toString()).catch(() => undefined);
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
    send(ws, {
      v: 1,
      id: null,
      type: 'event',
      event: 'state',
      payload: status()
    });
  });

  function send(ws: WebSocket, msg: AgentMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  async function handleMessage(ws: WebSocket, text: string): Promise<void> {
    let msg: RequestMessage;
    try {
      msg = JSON.parse(text) as RequestMessage;
    } catch {
      return;
    }
    if (msg.type !== 'request') return;
    const replyError = (code: Parameters<typeof humanMessage>[0], detail?: string): void => {
      send(ws, {
        v: 1,
        id: msg.id,
        type: 'response',
        ok: false,
        error: { code, message: humanMessage(code), detail }
      } satisfies ResponseMessage);
      deps.browsers.status = deps.browsers.status;
      deps.onStateChange?.(status());
    };
    try {
      switch (msg.action) {
        case 'ping': {
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: { pong: Date.now() } });
          break;
        }
        case 'status': {
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: status() });
          break;
        }
        case 'openBrowser': {
          const payload = (msg.payload || {}) as { platform?: string };
          const platform = payload.platform && ['instagram', 'facebook', 'tiktok'].includes(payload.platform)
            ? (payload.platform as Parameters<BrowserManager['openForLogin']>[0])
            : 'instagram';
          await deps.browsers.openForLogin(platform);
          deps.onStateChange?.(status());
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: { opened: platform } });
          break;
        }
        case 'closeBrowser': {
          await deps.browsers.closeAll();
          deps.onStateChange?.(status());
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: { closed: true } });
          break;
        }
        case 'diagnostic': {
          const payload = (msg.payload || {}) as { platform?: string };
          const platform = (payload.platform || 'instagram') as Parameters<HarvestRunner['diagnostic']>[0];
          const diag = await deps.runner.diagnostic(platform);
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: diag });
          break;
        }
        case 'extract': {
          if (deps.runner.busy) throw new CIError('INTERNAL', 'ya hay una extracci\u00f3n en curso');
          const p = (msg.payload || {}) as { url?: string; limit?: number; includeReplies?: boolean };
          const platform = detectPlatform(p.url || '');
          if (!platform) throw new CIError('PLATFORM_NOT_SUPPORTED', p.url);
          const normalized = normalizePostUrl(p.url as string, platform);
          deps.onStateChange?.(status());
          const result: ExtractResult = await deps.runner.extract(
            {
              url: normalized,
              platform,
              limit: Number(p.limit || 100),
              includeReplies: !!p.includeReplies
            },
            {
              onProgress: (progress: ProgressInfo) => {
                for (const c of clients) {
                  send(c, { v: 1, id: null, type: 'event', event: 'progress', payload: progress });
                }
              }
            }
          );
          deps.onStateChange?.(status());
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: result });
          break;
        }
        case 'stop': {
          deps.runner.requestStop();
          send(ws, { v: 1, id: msg.id, type: 'response', ok: true, data: { stopping: true } });
          break;
        }
        default: {
          throw new CIError('INTERNAL', 'acci\u00f3n desconocida: ' + String(msg.action));
        }
      }
    } catch (err) {
      if (err instanceof CIError) replyError(err.code, err.detail);
      else {
        const code = String((err as Error).message || '').startsWith('BROWSER_ERROR') ? 'BROWSER_ERROR' : 'INTERNAL';
        replyError(code, String((err as Error).message).slice(0, 300));
      }
    }
  }

  function status(): AgentStatusPayload {
    return {
      name: AGENT_NAME,
      version: AGENT_VERSION,
      state: deps.runner.busy ? 'BUSY' : 'IDLE',
      browser:
        deps.browsers.status === 'ready'
          ? 'ready'
          : deps.browsers.status === 'starting'
            ? 'starting'
            : deps.browsers.status === 'error'
              ? 'error'
              : 'closed',
      platforms: ['instagram', 'facebook', 'tiktok']
    };
  }

  return {
    wss,
    async start(): Promise<number> {
      const port = agentPort();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
      });
      return port;
    },
    broadcastEvent(event: EventMessage['event'], payload: unknown): void {
      for (const c of clients) {
        send(c, { v: 1, id: null, type: 'event', event, payload } as EventMessage);
      }
    },
    status,
    async close(): Promise<void> {
      for (const c of clients) c.close();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}

export function newRequestId(): string {
  return makeId() + crypto.randomBytes(2).toString('hex');
}
