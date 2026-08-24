'use client';

import { useState } from 'react';
import type { AppApi } from '@/lib/store';
import type { Platform } from '@ci/shared';

export default function DiagnosticsPanel({ api }: { api: AppApi }) {
  const [platform, setPlatform] = useState<Platform>('instagram');
  const d = api.diagnostics;
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold">Modo diagn\u00f3stico</h3>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform)}
          className="rounded-lg border border-edge bg-ink px-2 py-1 text-sm"
        >
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
        </select>
        <button
          onClick={() => void api.runDiagnostics(platform)}
          disabled={api.connState !== 'connected' && api.connState !== 'busy'}
          className="rounded-lg border border-edge px-3 py-1 text-xs font-semibold hover:bg-panel disabled:opacity-40"
        >
          Ejecutar diagn\u00f3stico
        </button>
      </div>

      {d ? (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] md:grid-cols-2">
          <Diag k="Agent" v={d.agent} />
          <Diag k="Browser" v={d.browser} />
          <Diag k="Platform" v={d.platform ?? '\u2014'} />
          <Diag k="Page" v={d.pageDetected ? 'DETECTED' : 'NOT DETECTED'} ok={d.pageDetected} />
          <Diag k="Post" v={d.postDetected ? 'DETECTED' : 'NOT DETECTED'} ok={d.postDetected} />
          <Diag k="Logged in" v={d.loggedIn == null ? '?' : d.loggedIn ? 'YES' : 'NO'} ok={d.loggedIn === true} bad={d.loggedIn === false} />
          <Diag k="Comment container" v={d.commentContainerDetected ? 'DETECTED' : 'NOT FOUND'} ok={d.commentContainerDetected} />
          <Diag k="Comments in DOM" v={String(d.commentsInDom)} />
          <Diag k="Scrolls" v={String(d.scrolls)} />
          <Diag k="Status" v={d.status} />
          {d.url && <Diag k="URL" v={d.url.slice(0, 48)} />}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Abre la publicaci\u00f3n en el navegador del agente y ejecuta el diagn\u00f3stico para inspeccionar el estado de la p\u00e1gina.
        </p>
      )}
    </div>
  );
}

function Diag({ k, v, ok, bad }: { k: string; v: string; ok?: boolean; bad?: boolean }): JSX.Element {
  return (
    <div className="flex justify-between gap-3 border-b border-edge/40 py-0.5">
      <span className="text-slate-500">{k}</span>
      <span className={`font-mono ${ok === true ? 'text-emerald-400' : bad === true ? 'text-rose-400' : 'text-slate-200'}`}>{v}</span>
    </div>
  );
}
