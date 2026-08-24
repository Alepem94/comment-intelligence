'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppApi, CommentRow } from '@/lib/store';
import { PlatformCommentCard } from './CommentCards';
import { exportCommentImage, copyNodeImageToClipboard } from '@/lib/imageExport';
import { buildSingleCommentHtml, copyHtmlToClipboard } from '@/lib/selfContainedHtml';
import type { Comment } from '@ci/shared';

interface Props {
  api: AppApi;
  uid: string | null;
  onClose: () => void;
}

export default function DetailPanel({ api, uid, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const row: CommentRow | null = uid ? api.rows.find((r) => r._uid === uid) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!row) return null;

  const doExport = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch {
      setBusy(null);
      alert('EXPORT_FAILED: no se pudo generar la imagen.');
      return;
    }
    setBusy(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-edge bg-ink shadow-2xl">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h3 className="text-sm font-bold">Detalle del comentario</h3>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-panel hover:text-white">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-xl ring-1 ring-edge [&>div]:mx-auto [&>div]:w-full">
          <PlatformCommentCard
            comment={stripUid(row)}
            avatarSrc={row.profile_image_url}
            innerRef={(el) => {
              cardRef.current = el;
            }}
          />
        </div>

        <dl className="space-y-2 rounded-xl border border-edge bg-panel p-4 text-sm">
          <Field k="Usuario" v={row.username ? '@' + row.username : row.display_name} />
          <Field k="Nombre" v={row.display_name} />
          <Field k="Likes" v={row.likes?.toLocaleString('es') ?? null} />
          <Field k="Fecha" v={row.timestamp} />
          <Field k="Respuestas" v={row.is_reply ? 'Es respuesta' : row.replies_count?.toLocaleString('es') ?? null} />
          <Field k="Plataforma" v={row.platform} />
          <div className="pt-1">
            <dt className="text-xs text-slate-500">URL original</dt>
            <dd className="truncate">
              <a href={row.post_url} target="_blank" rel="noreferrer" className="text-blue-400 underline">
                {row.post_url}
              </a>
            </dd>
          </div>
        </dl>

        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">{row.comment_text}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-edge p-4">
        <button
          disabled={!!busy || !cardRef.current}
          onClick={() => void doExport('jpg', () => exportCommentImage(cardRef.current!, stripUid(row), 'jpg'))}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
        >
          {busy === 'jpg' ? 'Generando...' : 'Descargar JPG'}
        </button>
        <button
          disabled={!!busy || !cardRef.current}
          onClick={() => void doExport('png', () => exportCommentImage(cardRef.current!, stripUid(row), 'png'))}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
        >
          {busy === 'png' ? 'Generando...' : 'Descargar PNG'}
        </button>
        <button
          disabled={!!busy}
          onClick={() =>
            void doExport('html', async () => {
              await copyHtmlToClipboard(buildSingleCommentHtml(stripUid(row)), row.comment_text);
            })
          }
          className="rounded-lg border border-edge px-3 py-2 text-sm font-semibold hover:bg-panel disabled:opacity-40"
        >
          Copiar HTML
        </button>
        <button
          onClick={() => void navigator.clipboard.writeText(row.comment_text)}
          className="rounded-lg border border-edge px-3 py-2 text-sm font-semibold hover:bg-panel"
        >
          Copiar texto
        </button>
        <button
          disabled={!!busy || !cardRef.current}
          onClick={() =>
            void doExport('clip', async () => {
              await copyNodeImageToClipboard(cardRef.current!);
            })
          }
          className="col-span-2 rounded-lg border border-edge px-3 py-2 text-xs text-slate-300 hover:bg-panel disabled:opacity-40"
        >
          Copiar imagen al portapapeles
        </button>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | null | undefined }): JSX.Element {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-xs text-slate-500">{k}</dt>
      <dd className="truncate text-right text-slate-200">{v ?? '—'}</dd>
    </div>
  );
}

function stripUid(r: CommentRow): Comment {
  const { _uid, ...rest } = r;
  void _uid;
  return rest;
}
