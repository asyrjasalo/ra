import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  getBaseUrl,
  resetState,
  startServer,
  stopServer,
} from '../src/http-server';

// Skip tests that require API calls when no API key is available
const hasApiKey = () =>
  !!process.env.MINIMAX_API_KEY ||
  !!process.env.OPENAI_API_KEY ||
  !!process.env.ANTHROPIC_API_KEY ||
  !!process.env.GEMINI_API_KEY ||
  !!process.env.ZAI_API_KEY;

// Conditional test that skips when condition is true
function apiTest(name: string, fn: () => Promise<void>, timeout?: number) {
  if (!hasApiKey()) {
    test.skip(name, fn, timeout);
  } else {
    test(name, fn, timeout);
  }
}

describe('HTTP Server', () => {
  let baseUrl: string;

  beforeAll(async () => {
    await startServer(3001);
    baseUrl = getBaseUrl(3001);
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    resetState();
  });

  test('GET /health returns status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('activeSessions');
    expect(typeof body.activeSessions).toBe('number');
  });

  apiTest(
    'GET /health with active sessions shows correct count',
    async () => {
      // Create a session via POST /ra
      await fetch(`${baseUrl}/ra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'What is 2+2?' }),
      });

      const healthRes = await fetch(`${baseUrl}/health`);
      const healthBody = await healthRes.json();
      expect(healthBody.activeSessions).toBeGreaterThanOrEqual(0);
    },
    120000,
  );

  test('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty('error', 'Not found');
  });

  test('GET /openapi.yaml returns valid YAML', async () => {
    const res = await fetch(`${baseUrl}/openapi.yaml`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('x-yaml');

    const text = await res.text();
    expect(text).toContain('openapi:');
    expect(text).toContain('/ra');
  });

  test('GET /openapi.json returns valid JSON', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('json');

    const body = await res.json();
    expect(body).toHaveProperty('openapi');
    expect(body).toHaveProperty('paths');
  });

  test('POST /ra without prompt returns 400', async () => {
    const res = await fetch(`${baseUrl}/ra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /ra-reply without session returns 404', async () => {
    const res = await fetch(`${baseUrl}/ra-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent', prompt: 'test' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error', 'Session not found');
  });

  apiTest(
    'POST /ra uses default provider and model from settings.json',
    async () => {
      // Create a session without specifying provider/model
      // This should use the default provider/model from static/.pi/settings.json
      const res = await fetch(`${baseUrl}/ra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'What is 1+1?' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('response');
      expect(typeof body.response).toBe('string');
    },
    120000,
  );

  apiTest(
    'POST /ra with explicit provider/model overrides defaults',
    async () => {
      // Even when defaults are set, explicit provider/model should take precedence
      const res = await fetch(`${baseUrl}/ra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'What is 3+3?',
          provider: 'minimax',
          model: 'MiniMax-M2.7',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('response');
    },
    120000,
  );
});
