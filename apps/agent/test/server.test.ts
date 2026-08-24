import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { createAgentServer } from '../src/server';
import { BrowserManager } from '../src/browser';
import { HarvestRunner } from '../src/harvestRunner';
import { loadOrCreateTokens } from '../src/tokens';

process.env.CI_AGENT_DATA_DIR = path.join(os.tmpdir(), 'ci-agent-test-' + Date.now());
process.env.CI_AGENT_PORT = '8799';

let server: ReturnType<typeof createAgentServer>;

beforeAll(() => {
  const tokens = loadOrCreateTokens();
  const browsers = new BrowserManager();
  const runner = new HarvestRunner(browsers);
  server = createAgentServer({ tokens, browsers, runner });
});

afterAll(async () => {
  await server.close();
});

describe('agent http surface', () => {
  it('exposes anonymous status', async () => {
    const port = await server.start();
    const res = await fetch(`http://127.0.0.1:${port}/ci/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toContain('Comment Intelligence');
  });

  it('rejects avatar proxy without token', async () => {
    const port = agentPortForTest();
    const res = await fetch(`http://127.0.0.1:${port}/ci/avatar-proxy?url=https://cdninstagram.com/x.jpg`);
    expect(res.status).toBe(401);
  });

  it('rejects avatar proxy with token but disallowed host (ssrf guard)', async () => {
    const port = agentPortForTest();
    const tokens = loadOrCreateTokens();
    const res = await fetch(
      `http://127.0.0.1:${port}/ci/avatar-proxy?url=https://evil.example.com/a.jpg&token=${tokens.token}`
    );
    expect(res.status).toBe(400);
  });
});

function agentPortForTest(): number {
  return 8799;
}
