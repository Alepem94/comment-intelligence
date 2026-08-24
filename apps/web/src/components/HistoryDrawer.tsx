'use client';

import { useState } from 'react';
import type { AppApi } from '@/lib/store';
import type { StoredExtraction } from '@/lib/idb';

export default function HistoryDrawer({
  api,
  onRestore
}: {
  api: AppApi;
  onRestore: (entry: StoredExtraction) => void;
}) {
  const [open, setOpen] = useState(false);
  if (api.history.length === 0) return null;
  void onRestore;
  return (
    <div className="rounded-2xl border border-edge bg-panel">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold">
        <span>
          Historial local ({api.history.length})
        </span>
        <span className="flex items-center gap-3">
          {open && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                void api.clearHistory();
              }}
              className="rounded-lg border border-rose-900 px-2 py-0.5 text-xs font-semibold text-rose-300 hover:bg-rose-950"
            >
              Limpiar historial
            </span>
          )}
          <span className="text-slate-500">{open ? 'Ocultar' : 'Mostrar'}</span>
        </span>
      </button>

      {open && (
        <ul className="space-y-1 border-t border-edge p-3">
          {api.history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-panel/60">
              <div className="min-w-0">
                <p className="truncate text-slate-200">{h.url}</p>
                <p className="text-xs text-slate-500">
                  {h.platform} Â· {new Date(h.savedAt).toLocaleString('es')} Â· {h.comments.length} comentarios
                </p>
              </div>
              <button
                onClick={() => onRestore(h)}
                className="shrink-0 rounded-lg border border-edge px-3 py-1 text-xs font-semibold hover:bg-panel"
              >
                Cargar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
