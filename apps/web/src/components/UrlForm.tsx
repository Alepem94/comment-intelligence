'use client';

import { useMemo, useState } from 'react';
import { detectPlatform } from '@ci/shared';
import type { Platform } from '@ci/shared';
import type { AppApi } from '@/lib/store';

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok'
};

const LIMITS = [100, 500, 1000, 5000];

export default function UrlForm({ api }: { api: AppApi }) {
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState(100);
  const [includeReplies, setIncludeReplies] = useState(false);

  const platform = useMemo(() => detectPlatform(url), [url]);
  const disabled = api.connState === 'disconnected' || api.connState === 'connecting' || !platform || api.extracting;

  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) void api.extract(url, limit, includeReplies);
          }}
          placeholder="Pega aquí la URL del Reel, video o publicación..."
          className="min-w-0 flex-1 rounded-xl border border-edge bg-ink px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-blue-500"
        />
        <button
          disabled={disabled}
          onClick={() => void api.extract(url, limit, includeReplies)}
          className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {api.extracting ? 'Extrayendo...' : 'Extraer comentarios'}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            platform ? 'bg-emerald-950 text-emerald-300 ring-1 ring-emerald-700' : 'bg-panel text-slate-400 ring-1 ring-edge'
          }`}
        >
          {platform ? PLATFORM_LABEL[platform] : 'Plataforma: pega una URL'}
        </span>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Cantidad
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
          >
            {LIMITS.map((l) => (
              <option key={l} value={l}>
                {l.toLocaleString('es')}
              </option>
            ))}
            <option value={999999}>Todos</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={includeReplies} onChange={(e) => setIncludeReplies(e.target.checked)} />
          Incluir respuestas
        </label>

        {api.extracting && (
          <button onClick={() => void api.stop()} className="ml-auto rounded-lg bg-rose-600/90 px-4 py-1.5 text-sm font-semibold hover:bg-rose-500">
            Detener extracción
          </button>
        )}
      </div>
    </div>
  );
}
