/**
 * Ra Coding Agent HTTP API Server
 *
 * REST API mirrors MCP tools: /ra (create + prompt), /ra-reply (continue)
 * Uses Hono for high-performance HTTP handling
 */

import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { ThinkingLevel } from '@mariozechner/pi-agent-core';
import {
  type AgentSession,
  AuthStorage,
  type CreateAgentSessionOptions,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent';
import { Hono } from 'hono';

// Extend Hono's context with our variables
interface AppVariables {
  body: RaRequestBody | RaReplyBody | Record<string, never>;
}

type AppContext = Hono<{ Variables: AppVariables }>;

// ─── Type Definitions ────────────────────────────────────────────────────────

interface RaRequestBody {
  readonly prompt: string;
  readonly provider?: string;
  readonly model?: string;
  readonly thinkingLevel?: string;
}

interface RaReplyBody {
  readonly id: string;
  readonly prompt: string;
}

interface RaResponse {
  readonly id: string;
  readonly response: string;
}

interface ErrorResponse {
  readonly error: string;
}

type ApiResponse<T> = { readonly status: number; readonly body: T };

interface SessionEntry {
  readonly session: AgentSession;
  readonly resourceLoader: DefaultResourceLoader;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── State ────────────────────────────────────────────────────────────────────

const sessions = new Map<string, SessionEntry>();

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function resetState(): void {
  for (const entry of sessions.values()) {
    entry.session.dispose();
  }
  sessions.clear();
}

function getStaticPath(...segments: string[]): string {
  return join(__dirname, '..', 'static', ...segments);
}

// Minimal YAML parser for OpenAPI spec (only handles the structure we use)
function yamlToJson(yaml: string): string {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [];
  let current: Record<string, unknown> = result;
  let currentKey = '';

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    if (content.startsWith('- ')) {
      // Array item
      const value = content.slice(2).trim();
      if (!currentKey) continue;

      if (!Array.isArray(current[currentKey])) {
        current[currentKey] = [];
      }
      const arr = current[currentKey] as unknown[];
      arr.push(value);
      continue;
    }

    const colonIdx = content.indexOf(':');
    if (colonIdx === -1) continue;

    currentKey = content.slice(0, colonIdx).trim();
    let value: unknown = content.slice(colonIdx + 1).trim();

    // Parse scalar values
    if (value === '' || value === '~' || value === 'null') {
      value = undefined;
    } else if (typeof value === 'string') {
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else {
        const num = Number(value);
        if (!Number.isNaN(num)) {
          value = num;
        }
      }
    }

    // Pop stack while indentation decreases
    while (stack.length > 0) {
      const last = stack[stack.length - 1];
      if (!last || indent <= last.indent) break;
      const popped = stack.pop();
      if (!popped) break;
      current = popped.obj;
    }

    if (value === undefined) {
      // Start a new object
      const newObj: Record<string, unknown> = {};
      current[currentKey] = newObj;
      stack.push({ obj: current, indent });
      current = newObj;
    } else {
      current[currentKey] = value;
    }
  }

  return JSON.stringify(result, null, 2);
}

// ─── Request Handlers ─────────────────────────────────────────────────────────

async function handlePi(
  body: RaRequestBody,
): Promise<ApiResponse<RaResponse | ErrorResponse>> {
  const { prompt, provider, model: modelName, thinkingLevel } = body;

  if (!prompt) {
    return { status: 400, body: { error: "Missing 'prompt' in request body" } };
  }

  // Validate thinking level
  const validThinkingLevels = ['off', 'low', 'medium', 'high'] as const;
  if (
    thinkingLevel &&
    !validThinkingLevels.includes(
      thinkingLevel as (typeof validThinkingLevels)[number],
    )
  ) {
    return {
      status: 400,
      body: {
        error: `Invalid 'thinkingLevel'. Must be one of: ${validThinkingLevels.join(', ')}`,
      },
    };
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd: getStaticPath('.pi'),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  });

  await resourceLoader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const sessionOptions: CreateAgentSessionOptions = {
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    authStorage,
    modelRegistry,
  };

  // Set model if provider and model are provided
  if (provider && modelName) {
    const model = modelRegistry.find(provider, modelName);
    if (!model) {
      return {
        status: 400,
        body: { error: `Model ${provider}/${modelName} not found` },
      };
    }
    sessionOptions.model = model;
  }

  // Set thinking level if provided
  if (thinkingLevel) {
    sessionOptions.thinkingLevel = thinkingLevel as ThinkingLevel;
  }

  const id = crypto.randomUUID();
  const { session } = await createAgentSession(sessionOptions);

  sessions.set(id, { session, resourceLoader });

  const modelInfo = provider && modelName ? ` (${provider}/${modelName})` : '';
  const thinkingInfo = thinkingLevel ? ` thinking=${thinkingLevel}` : '';
  console.log(
    `[${id}] Session created${modelInfo}${thinkingInfo}, prompt: ${prompt.substring(0, 80)}...`,
  );

  const responseParts: string[] = [];

  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent?.type === 'text_delta'
    ) {
      responseParts.push(event.assistantMessageEvent.delta);
    }
  });

  await session.prompt(prompt);
  unsubscribe();

  const response = responseParts.join('');

  return {
    status: 200,
    body: { id, response },
  };
}

async function handlePiReply(
  body: RaReplyBody,
): Promise<ApiResponse<RaResponse | ErrorResponse>> {
  const { id, prompt } = body;

  if (!prompt) {
    return { status: 400, body: { error: "Missing 'prompt' in request body" } };
  }

  if (!id) {
    return { status: 400, body: { error: "Missing 'id' in request body" } };
  }

  const entry = sessions.get(id);
  if (!entry) {
    return { status: 404, body: { error: 'Session not found' } };
  }

  console.log(`[${id}] Reply: ${prompt.substring(0, 80)}...`);

  const responseParts: string[] = [];

  const unsubscribe = entry.session.subscribe((event) => {
    if (
      event.type === 'message_update' &&
      event.assistantMessageEvent?.type === 'text_delta'
    ) {
      responseParts.push(event.assistantMessageEvent.delta);
    }
  });

  await entry.session.prompt(prompt);
  unsubscribe();

  const response = responseParts.join('');

  return {
    status: 200,
    body: { id, response },
  };
}

// ─── Server Setup ─────────────────────────────────────────────────────────────

let server: Server | null = null;

export async function startServer(port = PORT): Promise<Server> {
  const app = new Hono() as AppContext;

  // Middleware for JSON body parsing
  app.use('*', async (c, next) => {
    if (c.req.method === 'POST' || c.req.method === 'PUT') {
      try {
        const body = await c.req.json<RaRequestBody | RaReplyBody>();
        c.set('body', body as AppVariables['body']);
      } catch {
        c.set('body', {} as AppVariables['body']);
      }
    }
    await next();
  });

  // Route: POST /ra - Create new session + send first prompt
  app.post('/ra', async (c) => {
    const body = c.get('body') as RaRequestBody;
    const result = await handlePi(body);
    return c.json(result.body, result.status as 200 | 400 | 500);
  });

  // Route: POST /ra-reply - Send prompt to existing session
  app.post('/ra-reply', async (c) => {
    const body = c.get('body') as RaReplyBody;
    const result = await handlePiReply(body);
    return c.json(result.body, result.status as 200 | 400 | 404 | 500);
  });

  // Route: GET /openapi.yaml - Return OpenAPI spec as YAML
  app.get('/openapi.yaml', (c) => {
    const spec = readFileSync(getStaticPath('openapi.yaml'), 'utf-8');
    return c.body(spec, 200, { 'Content-Type': 'application/x-yaml' });
  });

  // Route: GET /openapi.json - Return OpenAPI spec as JSON
  app.get('/openapi.json', (c) => {
    const spec = readFileSync(getStaticPath('openapi.yaml'), 'utf-8');
    const json = yamlToJson(spec);
    return c.body(json, 200, { 'Content-Type': 'application/json' });
  });

  // Route: GET /health - Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', activeSessions: sessions.size });
  });

  // Custom 404 handler
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  return new Promise((resolve, reject) => {
    const httpServer = serve({
      fetch: app.fetch,
      port,
    });

    server = httpServer as unknown as Server;

    httpServer.on('error', reject);
    httpServer.on('listening', () => {
      resolve(server as Server);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getBaseUrl(port = PORT): string {
  return `http://localhost:${port}`;
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith('api/http-server.ts');

if (isMain) {
  startServer().then(() => {
    console.log(`Ra API running at http://localhost:${PORT}`);
    console.log(
      'Endpoints: POST /ra, POST /ra-reply, GET /openapi.yaml, GET /openapi.json, GET /health',
    );
  });
}
