'use client';

import { useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import type { CommentRow } from '@/lib/store';
import type { StoredExtraction } from '@/lib/idb';
import ConnectBar from '@/components/ConnectBar';
import UrlForm from '@/components/UrlForm';
import ProgressPanel from '@/components/ProgressPanel';
import FiltersBar from '@/components/FiltersBar';
import CommentsTable from '@/components/CommentsTable';
import DetailPanel from '@/components/DetailPanel';
import ExportBar from '@/components/ExportBar';
import DiagnosticsPanel from '@/components/DiagnosticsPanel';
import HistoryDrawer from '@/components/HistoryDrawer';
import ErrorBanner from '@/components/ErrorBanner';
import { PlatformCommentCard } from '@/components/CommentCards';
import { exportCommentImage } from '@/lib/imageExport';
import type { Comment } from '@ci/shared';

function stripUid(r: CommentRow): Comment {
  const { _uid, ...rest } = r;
  void _uid;
  return rest;
}

export default function Page() {
  const api = useApp();
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ rows: CommentRow[]; index: number; running: boolean; format: 'jpg' | 'png' } | null>(null);
  const batchCardRef = useRef<HTMLDivElement | null>(null);

  const runImageBatch = async (format: 'jpg' | 'png') => {
    const targets = api.selected.size > 0 ? api.selectedRows : api.filteredSorted;
    if (targets.length === 0 || batch?.running) return;
    setBatch({ rows: targets, index: 0, running: true, format });
    for (let i = 0; i < targets.length; i++) {
      setBatch({ rows: targets, index: i, running: true, format });
      await new Promise((r) => setTimeout(r, 350));
      if (batchCardRef.current) {
        try {
          await exportCommentImage(batchCardRef.current, stripUid(targets[i]), format);
        } catch {
          alert('EXPORT_FAILED: no se pudo generar una de las im\u00e1genes.');
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    setBatch(null);
  };

  const restore = (entry: StoredExtraction) => {
    api.clearSelection();
    window.scrollTo({ top: 0 });
    const restored: CommentRow[] = entry.comments.map((c, i) => ({ ...c, _uid: `h${Date.now()}_${i}` }));
    restoreRows(restored);
    setDetailUid(null);
  };

  const restoreRows = (rows: CommentRow[]) => {
    setRestored(rows);
  };

  const [restored, setRestored] = useState<CommentRow[] | null>(null);
  const effectiveApi = restored
    ? {
        ...api,
        rows: restored,
        filteredSorted: restored,
        selectedRows: [] as CommentRow[],
        selected: new Set<string>()
      }
    : api;

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">Comment Intelligence</h1>
          <p className="text-xs text-slate-500">Comentarios reales desde tu propio navegador. Sin servidores intermedios.</p>
        </div>
        <ConnectBar api={api} />
      </header>

      <UrlForm api={effectiveApi} />

      {(api.extracting || api.progress) && <ProgressPanel api={effectiveApi} />}

      {api.error && <ErrorBanner api={api} />}

      {effectiveApi.rows.length > 0 && (
        <>
          <FiltersBar api={effectiveApi} />
          <ExportBar api={effectiveApi} stripUid={stripUid} />

          {effectiveApi.selected.size > 0 && (
            <button
              onClick={() => void runImageBatch('jpg')}
              disabled={batch?.running}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
            >
              {batch?.running ? `Generando im\u00e1genes ${batch.index + 1}/${batch.rows.length}...` : 'Exportar im\u00e1genes JPG (selecci\u00f3n)'}
            </button>
          )}

          <CommentsTable api={effectiveApi} onOpen={(uid) => setDetailUid(uid)} />

          <div className="grid gap-5 lg:grid-cols-2">
            <DiagnosticsPanel api={api} />
            <HistoryDrawer api={api} onRestore={restore} />
          </div>
        </>
      )}

      {effectiveApi.rows.length === 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <DiagnosticsPanel api={api} />
          <HistoryDrawer api={api} onRestore={restore} />
        </div>
      )}

      <footer className="pb-6 pt-2 text-center text-[11px] text-slate-600">
        Las sesiones y cookies permanecen en tu computadora. Este servicio no almacena credenciales.
      </footer>

      <DetailPanel api={effectiveApi} uid={detailUid} onClose={() => setDetailUid(null)} />

      <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0 }}>
        {batch && batch.rows[batch.index] && (
          <PlatformCommentCard
            comment={stripUid(batch.rows[batch.index])}
            avatarSrc={batch.rows[batch.index].profile_image_url}
            innerRef={(el) => {
              batchCardRef.current = el;
            }}
          />
        )}
      </div>
    </main>
  );
}
