'use client';

import { humanMessage } from '@ci/shared';
import type { CIErrorCode } from '@ci/shared';
import type { AppApi } from '@/lib/store';

export default function ErrorBanner({ api }: { api: AppApi }) {
  if (!api.error) return null;
  let message = api.error.message;
  try {
    message = humanMessage(api.error.code as CIErrorCode);
  } catch {}
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-900 bg-rose-950/60 px-5 py-4">
      <div>
        <p className="text-sm font-bold text-rose-300">No pudimos completar la acción</p>
        <p className="mt-0.5 text-sm text-rose-100/90">{message}</p>
        <p className="mt-1 font-mono text-[11px] text-rose-400/70">{api.error.code}</p>
      </div>
      <button onClick={api.resetError} className="rounded-lg px-2 py-1 text-rose-300 hover:bg-rose-900/50">
        ✕
      </button>
    </div>
  );
}
