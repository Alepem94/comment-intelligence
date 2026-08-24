import type { CIErrorCode } from './errors';
import type { AgentStatusPayload, DiagnosticInfo, ExtractionOptions, ProgressInfo, Comment } from './types';

export const PROTOCOL_VERSION = 1;

export interface RequestMessage {
  v: typeof PROTOCOL_VERSION;
  id: string;
  type: 'request';
  action: 'ping' | 'status' | 'diagnostic' | 'openBrowser' | 'closeBrowser' | 'extract' | 'stop';
  payload?: unknown;
}

export interface ResponseMessage {
  v: typeof PROTOCOL_VERSION;
  id: string;
  type: 'response';
  ok: boolean;
  data?: unknown;
  error?: { code: CIErrorCode; message: string; detail?: string };
}

export interface EventMessage {
  v: typeof PROTOCOL_VERSION;
  id: string | null;
  type: 'event';
  event: 'progress' | 'state' | 'log';
  payload: ProgressInfo | AgentStatusPayload | { message: string };
}

export type AgentMessage = RequestMessage | ResponseMessage | EventMessage;

export type ExtractPayload = ExtractionOptions;
export interface ExtractResult {
  comments: Comment[];
  diagnostics: DiagnosticInfo;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
