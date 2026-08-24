'use client';

import { useMemo, useRef, useState } from 'react';
import type { AppApi, CommentRow } from '@/lib/store';
import type { Platform } from '@ci/shared';

const ROW_H = 64;
const OVERSCAN = 8;

const PLATFORM_BADGE: Record<Platform, string> = {
  instagram: 'IG',
  facebook: 'FB',
  tiktok: 'TT'
};

function AvatarCell({ row }: { row: CommentRow }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const src = row.profile_image_url;
  if (!src || failed) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[11px] font-bold">
        {(row.username || row.display_name || '?').slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
        <img src={src} alt="" width={36} height={36} onError={() => setFailed(true)} className="h-9 w-9 rounded-full object-cover" />
  );
}

export default function CommentsTable({ api, onOpen }: { api: AppApi; onOpen: (uid: string) => void }) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rows = api.filteredSorted;
  const height = Math.min(560, rows.length * ROW_H);

  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const visible = Math.ceil(560 / ROW_H) + OVERSCAN * 2;
    return { start, end: Math.min(rows.length, start + visible) };
  }, [scrollTop, rows.length]);

  if (api.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge p-10 text-center text-sm text-slate-500">
        AÃºn no hay comentarios. Pega una URL y extrae para comenzar.
      </div>
    );
  }

  const allFilteredSelected = rows.length > 0 && rows.every((r) => api.selected.has(r._uid));
  const slice = rows.slice(range.start, range.end);
  void viewportRef;

  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-panel">
      <div className="grid grid-cols-[44px_56px_150px_1fr_70px_90px_90px_60px] items-center gap-2 border-b border-edge px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={(e) => {
            if (e.target.checked) api.selectAllFiltered(rows.map((r) => r._uid));
            else api.clearSelection();
          }}
        />
        <span>Avatar</span>
        <span>Usuario</span>
        <span>Comentario</span>
        <span>Likes</span>
        <span>Fecha</span>
        <span>Resp.</span>
        <span>Plat.</span>
      </div>

      <div style={{ height }} className="relative overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {rows.length > 0 && (
          <div style={{ height: rows.length * ROW_H, position: 'relative' }}>
            {slice.map((r, i) => {
              const idx = range.start + i;
              const isSel = api.selected.has(r._uid);
              return (
                <div
                  key={r._uid}
                  onClick={() => onOpen(r._uid)}
                  className={`absolute inset-x-0 grid cursor-pointer grid-cols-[44px_56px_150px_1fr_70px_90px_90px_60px] items-center gap-2 border-b border-edge/50 px-3 text-sm transition-colors ${
                    isSel ? 'bg-blue-950/40' : 'hover:bg-panel/80'
                  }`}
                  style={{ top: idx * ROW_H, height: ROW_H }}
                >
                  <input type="checkbox" checked={isSel} onChange={() => api.toggleSelected(r._uid)} onClick={(e) => e.stopPropagation()} />
                  <AvatarCell row={r} />
                  <div className="truncate font-medium text-slate-200">@{r.username || r.display_name || 'usuario'}</div>
                  <div className="line-clamp-2 pr-4 text-slate-300">{r.comment_text}</div>
                  <div className="text-slate-300">{r.likes?.toLocaleString('es') ?? '\u2014'}</div>
                  <div className="truncate text-xs text-slate-500">{r.timestamp ?? '\u2014'}</div>
                  <div className="text-slate-400">{r.is_reply ? 'respuesta' : (r.replies_count ?? '\u2014')}</div>
                  <span className={`justify-self-start rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    r.platform === 'instagram' ? 'bg-pink-950 text-pink-300' : r.platform === 'facebook' ? 'bg-blue-950 text-blue-300' : 'bg-cyan-950 text-cyan-300'
                  }`}>
                    {PLATFORM_BADGE[r.platform]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
