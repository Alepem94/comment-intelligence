'use client';

import type { AppApi } from '@/lib/store';

export default function ProgressPanel({ api }: { api: AppApi }) {
  const p = api.progress;
  if (!p) return null;
  return (
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-100">Extrayendo comentarios...</h3>
        {api.extracting && (
          <button onClick={() => void api.stop()} className="rounded-lg bg-rose-600/90 px-3 py-1 text-xs font-semibold hover:bg-rose-500">
            Detener
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-300">
        <span className="font-bold text-blue-400">{p.found.toLocaleString('es')}</span> comentarios encontrados
        {' \u00b7 '}
        <span className="text-emerald-300">{p.addedTotal.toLocaleString('es')} nuevos</span>
        {' \u00b7 '}
        <span className="text-slate-400">{p.duplicates.toLocaleString('es')} duplicados</span>
        {' \u00b7 '}
        {p.scrolls} scrolls
      </p>
      {p.lastCommentText && (
        <p className="mt-2 truncate text-xs text-slate-500">
          Último comentario: &ldquo;{p.lastCommentText}&rdquo;
        </p>
      )}
    </div>
  );
}
