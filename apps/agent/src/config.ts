import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const AGENT_NAME = 'Comment Intelligence Agent';
export const AGENT_VERSION = '0.1.0';

export function agentPort(): number {
  const p = parseInt(process.env.CI_AGENT_PORT || '', 10);
  return Number.isFinite(p) && p > 0 ? p : 8765;
}

export function dataRoot(): string {
  if (process.env.CI_AGENT_DATA_DIR) return process.env.CI_AGENT_DATA_DIR;
  return path.join(os.homedir(), '.comment-intelligence');
}

export function profilesRoot(): string {
  return path.join(dataRoot(), 'profiles');
}

export function tokensFile(): string {
  return path.join(dataRoot(), 'agent-token.json');
}

export function ensureDirs(): void {
  fs.mkdirSync(profilesRoot(), { recursive: true });
}
