'use client';

import { useState } from 'react';
import type { Platform } from '@ci/shared';
import type { AppApi } from '@/lib/store';

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' }
];

export default function ConnectBar({ api }: { api: AppApi }) {
  const [port, setPort] = useState('8765');
  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState(false);

  const label: Record<string, string> = {
    disconnected: '\u25cf Desconectado',
    connecting: '\u25cf Conectando...',
    connected: '\u25cf Agente conectado',
    busy: '\u25cf Extrayendo...',
    error: '\u25cf Error de conexi\u00f3n'
  };
  const color =
    api.connState === 'connected' || api.connState === 'busy'
      ? 'text-emerald-400'
      : api.connState === 'connecting'
        ? 'text-amber-300'
        : 'text-rose-400';

  if (api.connState === 'connected' || api.connState === 'busy') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-sm font-medium ${color}`}>{label[api.connState]}</span>
        <span className="hidden text-xs text-slate-500 sm:inline">Iniciar sesión:</span>
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => void api.openBrowser(p.id)}
            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-slate-200 hover:bg-panel"
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className={`text-sm ${color}`}>{label[api.connState]}</span>
      {api.hasAgentConfig ? null : (
        <div className="flex items-center gap-2">
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-20 rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm"
            placeholder="8765"
            inputMode="numeric"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPairing(true);
                void api.connect(parseInt(port, 10) || 8765, code).finally(() => setPairing(false));
              }
            }}
            className="w-32 rounded-lg border border-edge bg-panel px-2 py-1.5 text-sm uppercase tracking-widest"
            placeholder="Código"
          />
          <button
            disabled={pairing || !code}
            onClick={() => {
              setPairing(true);
              void api.connect(parseInt(port, 10) || 8765, code).finally(() => setPairing(false));
            }}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
          >
            Conectar
          </button>
        </div>
      )}
    </div>
  );
}
