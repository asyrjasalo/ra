/**
 * Pi Coding Agent HTTP API Server
 * 
 * REST API for pi-coding-agent sessions
 */

import { createServer, Server, IncomingMessage, ServerResponse } from "node:http";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const PORT = parseInt(process.env.PORT || "3000");

// In-memory session store
const sessions = new Map<string, ReturnType<typeof createAgentSession>["session"]>();
const sessionResources = new Map<string, DefaultResourceLoader>();

// Export for testing
export function resetState() {
  for (const session of sessions.values()) {
    session.dispose();
  }
  sessions.clear();
  sessionResources.clear();
}

// ---------------------------------------------------------------------------
// Server Setup
// ---------------------------------------------------------------------------

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
      // Destroy all existing connections to force close SSE streams
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

// ---------------------------------------------------------------------------
// Request Handling
// ---------------------------------------------------------------------------

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = req.url?.split("?")[0] || "/";
  const method = req.method || "GET";

  try {
    let body: Record<string, unknown> = {};

    // Parse request body for POST/PUT requests
    if (method === "POST" || method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      if (chunks.length > 0) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          // ignore parse errors
        }
      }
    }

    // Route: POST /sessions - Create new session
    if (path === "/sessions" && method === "POST") {
      const result = await createSession();
      sendResponse(res, result.status, result.body);
      return;
    }

    // Route: GET /sessions/:id - Get session info
    if (path.match(/^\/sessions\/[^/]+$/) && method === "GET") {
      const id = path.split("/")[2];
      const result = getSession(id);
      sendResponse(res, result.status, result.body);
      return;
    }

    // Route: DELETE /sessions/:id - Delete session
    if (path.startsWith("/sessions/") && method === "DELETE") {
      const parts = path.split("/");
      if (parts.length >= 3) {
        const result = deleteSession(parts[2]);
        sendResponse(res, result.status, result.body);
        return;
      }
    }

    // Route: POST /sessions/:id/prompt - Send prompt to session
    if (path.match(/^\/sessions\/[^/]+\/prompt$/) && method === "POST") {
      const id = path.split("/")[2];
      const result = await sendPrompt(id, body);
      sendResponse(res, result.status, result.body);
      return;
    }

    // Route: GET /sessions/:id/events - SSE stream for session events
    if (path.match(/^\/sessions\/[^/]+\/events$/) && method === "GET") {
      const id = path.split("/")[2];
      streamEvents(res, id);
      return;
    }

    // Health check
    if (path === "/health" && method === "GET") {
      sendResponse(res, 200, { status: "ok", sessions: sessions.size });
      return;
    }

    sendResponse(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("Request error:", err);
    sendResponse(res, 500, { error: "Internal server error" });
  }
}

function sendResponse(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body, null, 2));
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

async function createSession(): Promise<{ status: number; body: unknown }> {
  const id = crypto.randomUUID();

  const resourceLoader = new DefaultResourceLoader({
    cwd: `${process.env.HOME}/.pi/agent`,
  });

  await resourceLoader.reload();

  const { session } = await createAgentSession({
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
  });

  sessions.set(id, session);
  sessionResources.set(id, resourceLoader);

  console.log(`[${id}] Session created`);

  return { status: 201, body: { id } };
}

function getSession(id: string): { status: number; body: unknown } {
  if (!sessions.has(id)) {
    return { status: 404, body: { error: "Session not found" } };
  }

  return {
    status: 200,
    body: { id, exists: true },
  };
}

function deleteSession(id: string): { status: number; body: unknown } {
  const session = sessions.get(id);
  if (!session) {
    return { status: 404, body: { error: "Session not found" } };
  }

  session.dispose();
  sessions.delete(id);
  sessionResources.delete(id);

  console.log(`[${id}] Session disposed`);

  return { status: 200, body: { message: "Session deleted" } };
}

async function sendPrompt(id: string, body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const session = sessions.get(id);
  if (!session) {
    return { status: 404, body: { error: "Session not found" } };
  }

  if (!body.prompt) {
    return { status: 400, body: { error: "Missing 'prompt' in request body" } };
  }

  console.log(`[${id}] Prompt: ${String(body.prompt).substring(0, 80)}...`);

  await session.prompt(String(body.prompt));

  return { status: 200, body: { message: "Prompt sent", id } };
}

function streamEvents(res: ServerResponse, id: string): void {
  const session = sessions.get(id);
  if (!session) {
    sendResponse(res, 404, { error: "Session not found" });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = session.subscribe((event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client disconnected
    }
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, 30000);

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

const isMain = process.argv[1]?.endsWith("api/server.ts");

if (isMain) {
  startServer().then(() => {
    console.log(`Pi Coding Agent API running at http://localhost:${PORT}`);
  });
}
