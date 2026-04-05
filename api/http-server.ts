/**
 * Pi Coding Agent HTTP API Server
 * 
 * REST API mirrors MCP tools: /pi (create + prompt), /pi-reply (continue)
 */

import { createServer, Server, IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const PORT = parseInt(process.env.PORT || "3000");

const sessions = new Map<string, Awaited<ReturnType<typeof createAgentSession>>["session"]>();
const sessionResources = new Map<string, DefaultResourceLoader>();

let activeSessionId: string | null = null;

export function resetState() {
  for (const session of sessions.values()) {
    session.dispose();
  }
  sessions.clear();
  sessionResources.clear();
  activeSessionId = null;
}

let server: Server | null = null;

export async function startServer(port = PORT): Promise<Server> {
  return new Promise((resolve, reject) => {
    server = createServer(handleRequest);
    server.on("error", reject);
    server.listen(port, () => {
      resolve(server!);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.on("connection", (socket) => {
        socket.destroy();
      });
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

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = req.url?.split("?")[0] || "/";
  const method = req.method || "GET";

  try {
    let body: Record<string, unknown> = {};

    if (method === "POST" || method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
        }
      }
    }

    // Route: POST /pi - Create new session + send first prompt
    if (path === "/pi" && method === "POST") {
      const result = await handlePi(body);
      sendResponse(res, result.status, result.body);
      return;
    }

    // Route: POST /pi-reply - Send prompt to existing session
    if (path === "/pi-reply" && method === "POST") {
      const result = await handlePiReply(body);
      sendResponse(res, result.status, result.body);
      return;
    }

    // Route: GET /openapi.yaml - Return OpenAPI spec as YAML
    if (path === "/openapi.yaml" && method === "GET") {
      const spec = readFileSync(join(import.meta.dir, "..", "static", "openapi.yaml"), "utf-8");
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/x-yaml");
      res.end(spec);
      return;
    }

    // Route: GET /openapi.json - Return OpenAPI spec as JSON
    if (path === "/openapi.json" && method === "GET") {
      const spec = readFileSync(join(import.meta.dir, "..", "static", "openapi.yaml"), "utf-8");
      const json = yamlToJson(spec);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(json);
      return;
    }

    // Route: GET /health - Health check
    if (path === "/health" && method === "GET") {
      sendResponse(res, 200, { status: "ok", activeSessions: sessions.size });
      return;
    }

    sendResponse(res, 404, { error: "Not found" });
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Request error:", err);
    }
    sendResponse(res, 500, { error: "Internal server error" });
  }
}

function sendResponse(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body, null, 2));
}

// Simple YAML to JSON converter for the OpenAPI spec
function yamlToJson(yaml: string): string {
  // Basic YAML parsing - handles the structure of our OpenAPI spec
  const lines = yaml.split("\n");
  const result: Record<string, unknown> = {};
  let current: Record<string, unknown> = result;
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [];

  for (const line of lines) {
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx);
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Handle quoted strings
    if (value === "") value = undefined;
    else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(Number(value))) value = Number(value);

    // Pop stack while indentation decreases
    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      const popped = stack.pop()!;
      current = popped.obj as Record<string, unknown>;
    }

    if (value === undefined) {
      // Start a new object/array
      const newObj: Record<string, unknown> = {};
      current[key] = newObj;
      stack.push({ obj: current, indent });
      current = newObj;
    } else {
      current[key] = value;
    }
  }

  return JSON.stringify(result, null, 2);
}

async function handlePi(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const prompt = body.prompt as string;
  const timeout = (body.timeout as number) || 120000;

  if (!prompt) {
    return { status: 400, body: { error: "Missing 'prompt' in request body" } };
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd: join(import.meta.dir, "..", ".pi"),
  });

  await resourceLoader.reload();

  const id = crypto.randomUUID();
  const { session } = await createAgentSession({
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  sessions.set(id, session);
  sessionResources.set(id, resourceLoader);
  activeSessionId = id;

  console.log(`[${id}] Session created, prompt: ${prompt.substring(0, 80)}...`);

  const events: unknown[] = [];
  const responseParts: string[] = [];
  const unsubscribe = session.subscribe((event) => {
    events.push(event);
    // Extract text deltas from assistant messages
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      responseParts.push(event.assistantMessageEvent.delta);
    }
  });

  await Promise.race([
    session.prompt(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
  ]);

  unsubscribe();

  const response = responseParts.join("");

  return {
    status: 200,
    body: { id, response },
  };
}

async function handlePiReply(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const prompt = body.prompt as string;
  const timeout = (body.timeout as number) || 120000;

  if (!prompt) {
    return { status: 400, body: { error: "Missing 'prompt' in request body" } };
  }

  const id = body.id as string;

  if (!id) {
    return { status: 400, body: { error: "Missing 'id' in request body" } };
  }

  if (!sessions.has(id)) {
    return { status: 404, body: { error: "Session not found" } };
  }

  const session = sessions.get(id)!;

  console.log(`[${id}] Reply: ${prompt.substring(0, 80)}...`);

  const events: unknown[] = [];
  const responseParts: string[] = [];
  const unsubscribe = session.subscribe((event) => {
    events.push(event);
    // Extract text deltas from assistant messages
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      responseParts.push(event.assistantMessageEvent.delta);
    }
  });

  await Promise.race([
    session.prompt(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)),
  ]);

  unsubscribe();

  const response = responseParts.join("");

  return {
    status: 200,
    body: { id, response },
  };
}

const isMain = process.argv[1]?.endsWith("api/http-server.ts");

if (isMain) {
  startServer().then(() => {
    console.log(`Pi Coding Agent API running at http://localhost:${PORT}`);
    console.log("Endpoints: POST /pi, POST /pi-reply, GET /openapi.yaml, GET /openapi.json, GET /health");
  });
}