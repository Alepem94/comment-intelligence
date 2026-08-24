export type Platform = 'instagram' | 'facebook' | 'tiktok';

export interface Comment {
  platform: Platform;
  post_url: string;
  post_id: string | null;
  comment_id: string | null;
  username: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  comment_text: string;
  timestamp: string | null;
  likes: number | null;
  replies_count: number | null;
  parent_comment_id: string | null;
  is_reply: boolean;
  scraped_at: string;
}

export interface RawComment {
  username?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  text?: string | null;
  time_text?: string | null;
  datetime?: string | null;
  likes?: number | null;
  reply_count?: number | null;
  id?: string | null;
  parent_id?: string | null;
  is_reply?: boolean;
}

export interface ExtractionOptions {
  url: string;
  platform: Platform;
  limit: number;
  includeReplies: boolean;
}

export interface ProgressInfo {
  found: number;
  addedTotal: number;
  duplicates: number;
  scrolls: number;
  lastCommentText: string | null;
  status: 'running' | 'stopping' | 'done' | 'error';
}

export interface DiagnosticInfo {
  agent: string;
  browser: string;
  platform: Platform | null;
  pageDetected: boolean;
  postDetected: boolean;
  loggedIn: boolean | null;
  commentContainerDetected: boolean;
  commentsInDom: number;
  mutationObserverActive: boolean;
  scrolls: number;
  status: string;
  url: string | null;
}

export type AgentRuntimeState = 'IDLE' | 'BUSY' | 'ERROR';

export interface AgentStatusPayload {
  name: string;
  version: string;
  state: AgentRuntimeState;
  browser: 'ready' | 'closed' | 'starting' | 'error';
  platforms: Platform[];
}
