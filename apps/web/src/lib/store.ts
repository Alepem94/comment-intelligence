'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectPlatform, normalizePostUrl, extractPostId } from '@ci/shared';
import type { Comment, Platform, ProgressInfo, DiagnosticInfo } from '@ci/shared';
import { getAgentClient, loadStoredConfig, type AgentClient, type ConnectionState } from './agentClient';
import { listExtractions, saveExtraction, clearExtractions, type StoredExtraction } from './idb';

export interface CommentRow extends Comment {
  _uid: string;
}

export interface Filters {
  query: string;
  minLikes: number;
  kind: 'all' | 'comments' | 'replies';
  platform: 'all' | Platform;
  selection: 'all' | 'selected' | 'unselected';
}

const DEFAULT_FILTERS: Filters = {
  query: '',
  minLikes: 0,
  kind: 'all',
  platform: 'all',
  selection: 'all'
};

export function useApp() {
  const agentRef = useRef<AgentClient | null>(null);
  if (!agentRef.current && typeof window !== 'undefined') agentRef.current = getAgentClient();
  const agent = agentRef.current;

  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<'default' | 'likes-desc' | 'likes-asc' | 'user'>('default');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [history, setHistory] = useState<StoredExtraction[]>([]);
  const [hasAgentConfig, setHasAgentConfig] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ url: string; platform: Platform; finishedAt: string } | null>(null);

  useEffect(() => {
    setHasAgentConfig(!!loadStoredConfig());
    void listExtractions().then(setHistory).catch(() => undefined);
    if (!agent) return;
    agent.onStateChange = setConnState;
    agent.onProgress = (p) => setProgress(p);
    agent.connect();
    return () => agent.disconnect();
  }, [agent]);

  useEffect(() => {
    const unsub = agent?.subscribe('progress', (p) => setProgress(p as ProgressInfo));
    return unsub;
  }, [agent]);

  const connect = useCallback(
    async (port: number, code: string) => {
      if (!agent) return;
      setError(null);
      try {
        await agent.pair(port, code);
        agent.connect();
        setHasAgentConfig(true);
      } catch (err) {
        setError({ code: 'UNAUTHORIZED', message: (err as Error).message });
      }
    },
    [agent]
  );

  const extract = useCallback(
    async (url: string, limit: number, includeReplies: boolean) => {
      if (!agent) return;
      const platform = detectPlatform(url);
      if (!platform) {
        setError({ code: 'PLATFORM_NOT_SUPPORTED', message: 'Enlace no reconocido. Usa una URL de Instagram, Facebook o TikTok.' });
        return;
      }
      setError(null);
      setExtracting(true);
      setProgress({ found: 0, addedTotal: 0, duplicates: 0, scrolls: 0, lastCommentText: null, status: 'running' });
      try {
        const normalized = normalizePostUrl(url, platform);
        const result = await agent.extract({ url: normalized, platform, limit, includeReplies });
        const newRows: CommentRow[] = result.comments.map((c, i) => ({ ...c, _uid: `r${Date.now()}_${i}` }));
        setRows(newRows);
        setSelected(new Set());
        setFilters(DEFAULT_FILTERS);
        setLastMeta({ url: normalized, platform, finishedAt: new Date().toISOString() });
        await saveExtraction({
          id: `${platform}-${extractPostId(normalized, platform) || Date.now()}`,
          url: normalized,
          platform,
          savedAt: new Date().toISOString(),
          comments: result.comments
        }).catch(() => undefined);
        void listExtractions().then(setHistory).catch(() => undefined);
      } catch (err) {
        const e = err as Error & { code?: string };
        setError({
          code: e.code || 'INTERNAL',
          message: e.message
        });
      } finally {
        setExtracting(false);
        setTimeout(() => setProgress(null), 1200);
      }
    },
    [agent]
  );

  const stop = useCallback(async () => {
    await agent?.stop().catch(() => undefined);
  }, [agent]);

  const runDiagnostics = useCallback(
    async (platform: Platform) => {
      try {
        const d = await agent?.diagnostic(platform);
        if (d) setDiagnostics(d);
      } catch (err) {
        const e = err as Error & { code?: string };
        setError({ code: e.code || 'INTERNAL', message: e.message });
      }
    },
    [agent]
  );

  const openBrowser = useCallback(
    async (platform: Platform) => {
      try {
        await agent?.openBrowser(platform);
      } catch (err) {
        const e = err as Error & { code?: string };
        setError({ code: e.code || 'BROWSER_ERROR', message: e.message });
      }
    },
    [agent]
  );

  const toggleSelected = useCallback((uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(
    (uids: string[]) => setSelected(new Set(uids)),
    []
  );
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const clearHistory = useCallback(async () => {
    await clearExtractions().catch(() => undefined);
    setHistory([]);
  }, []);

  const filteredSorted = useMemo(() => {
    let out = rows;
    const q = filters.query.trim().toLowerCase();
    if (q) out = out.filter((r) => r.comment_text.toLowerCase().includes(q) || (r.username || '').toLowerCase().includes(q) || (r.display_name || '').toLowerCase().includes(q));
    if (filters.minLikes > 0) out = out.filter((r) => (r.likes ?? 0) >= filters.minLikes);
    if (filters.kind === 'comments') out = out.filter((r) => !r.is_reply);
    if (filters.kind === 'replies') out = out.filter((r) => r.is_reply);
    if (filters.platform !== 'all') out = out.filter((r) => r.platform === filters.platform);
    if (filters.selection === 'selected') out = out.filter((r) => selected.has(r._uid));
    if (filters.selection === 'unselected') out = out.filter((r) => !selected.has(r._uid));
    const copy = [...out];
    if (sortKey === 'likes-desc') copy.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    else if (sortKey === 'likes-asc') copy.sort((a, b) => (a.likes ?? 0) - (b.likes ?? 0));
    else if (sortKey === 'user') copy.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    return copy;
  }, [rows, filters, selected, sortKey]);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r._uid)), [rows, selected]);

  const resetError = useCallback(() => setError(null), []);

  return {
    connState,
    hasAgentConfig,
    progress,
    extracting,
    error,
    rows,
    filteredSorted,
    selected,
    selectedRows,
    filters,
    setFilters,
    sortKey,
    setSortKey,
    diagnostics,
    history,
    lastMeta,
    connect,
    extract,
    stop,
    runDiagnostics,
    openBrowser,
    toggleSelected,
    selectAllFiltered,
    clearSelection,
    clearHistory,
    resetError
  };
}

export type AppApi = ReturnType<typeof useApp>;
