import crypto from 'node:crypto';
import fs from 'node:fs';
import { tokensFile, ensureDirs } from './config';

export interface AgentTokens {
  token: string;
  pairingCode: string;
  createdAt: string;
}

export function loadOrCreateTokens(): AgentTokens {
  ensureDirs();
  const file = tokensFile();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const t = JSON.parse(raw) as AgentTokens;
    if (t && t.token && t.pairingCode) return t;
  } catch {
    /* create new */
  }
  const token = crypto.randomBytes(24).toString('hex');
  const pairingCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const t: AgentTokens = { token, pairingCode, createdAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(t, null, 2), 'utf8');
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* windows ignores */
  }
  return t;
}
