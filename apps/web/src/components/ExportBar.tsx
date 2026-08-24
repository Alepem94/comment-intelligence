'use client';

import type { AppApi } from '@/lib/store';
import { buildCsv, downloadFile, slugify } from '@/lib/exportCsv';
import { buildSelfContainedHtml, copyHtmlToClipboard } from '@/lib/selfContainedHtml';
import type { Comment } from '@ci/shared';
import type { CommentRow } from '@/lib/store';

interface Props {
  api: AppApi;
  stripUid: (r: CommentRow) => Comment;
}

export default function ExportBar({ api, stripUid }: Props) {
  if (api.rows.length === 0) return null;
  const count = api.selected.size;
  const scopeLabel = count > 0 ? `${count} comentarios seleccionados` : `${api.filteredSorted.length} comentarios filtrados`;
  const target = (): Comment[] => (count > 0 ? api.selectedRows.map(stripUid) : api.filteredSorted.map(stripUid));

  const baseName = () => {
    const meta = api.lastMeta;
    const platform = meta?.platform ?? 'comentarios';
    return `${platform}-${slugify(meta?.url || '')}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-edge bg-panel px-4 py-3">
      <span className="text-sm text-slate-300">{scopeLabel}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <button
          onClick={() => downloadFile(buildCsv(target()), `${baseName()}.csv`)}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500"
        >
          Exportar CSV
        </button>
        <button
          onClick={() =>
            downloadFile(
              new Blob([buildCsv(target())], { type: 'text/csv;charset=utf-8' }),
              `${baseName()}-utf8.csv`
            )
          }
          className="hidden"
        />
        <button
          onClick={async () => {
            const ok = await copyHtmlToClipboard(buildSelfContainedHtml(target(), 'Comentarios'), target()[0]?.comment_text || '');
            alert(ok ? 'HTML copiado al portapapeles.' : 'No se pudo copiar el HTML.');
          }}
          className="rounded-lg border border-edge px-4 py-1.5 text-sm font-semibold hover:bg-panel"
        >
          Copiar HTML
        </button>
      </div>
    </div>
  );
}
