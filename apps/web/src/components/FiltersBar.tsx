'use client';

import type { AppApi } from '@/lib/store';

const MIN_LIKES = [0, 10, 50, 100, 500, 1000];

export default function FiltersBar({ api }: { api: AppApi }) {
  if (api.rows.length === 0) return null;
  const f = api.filters;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-edge bg-panel px-4 py-3">
      <input
        value={f.query}
        onChange={(e) => api.setFilters({ ...f, query: e.target.value })}
        placeholder="Buscar texto o usuario..."
        className="w-56 rounded-lg border border-edge bg-ink px-3 py-1.5 text-sm outline-none placeholder:text-slate-500 focus:border-blue-500"
      />

      <select
        value={f.minLikes}
        onChange={(e) => api.setFilters({ ...f, minLikes: Number(e.target.value) })}
        className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
      >
        {MIN_LIKES.map((n) => (
          <option key={n} value={n}>
            {n === 0 ? 'Likes: todos' : `> ${n.toLocaleString('es')} likes`}
          </option>
        ))}
      </select>

      <select
        value={f.kind}
        onChange={(e) => api.setFilters({ ...f, kind: e.target.value as typeof f.kind })}
        className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
      >
        <option value="all">Comentarios y respuestas</option>
        <option value="comments">Solo comentarios</option>
        <option value="replies">Solo respuestas</option>
      </select>

      <select
        value={f.platform}
        onChange={(e) => api.setFilters({ ...f, platform: e.target.value as typeof f.platform })}
        className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
      >
        <option value="all">Todas las plataformas</option>
        <option value="instagram">Instagram</option>
        <option value="facebook">Facebook</option>
        <option value="tiktok">TikTok</option>
      </select>

      <select
        value={api.sortKey}
        onChange={(e) => api.setSortKey(e.target.value as typeof api.sortKey)}
        className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
      >
        <option value="default">Orden original</option>
        <option value="likes-desc">Más likes</option>
        <option value="likes-asc">Menos likes</option>
        <option value="user">Usuario A-Z</option>
      </select>

      <select
        value={f.selection}
        onChange={(e) => api.setFilters({ ...f, selection: e.target.value as typeof f.selection })}
        className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm"
      >
        <option value="all">Todos</option>
        <option value="selected">Seleccionados</option>
        <option value="unselected">No seleccionados</option>
      </select>
    </div>
  );
}
