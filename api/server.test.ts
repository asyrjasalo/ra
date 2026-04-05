/**
 * HTTP API Tests
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetState,
} from "./server.ts";

let baseUrl: string;

beforeAll(async () => {
  resetState();
  await startServer(3001);
  baseUrl = getBaseUrl(3001);
});

afterAll(async () => {
  resetState();
  await stopServer();
});

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  test("returns ok status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.sessions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

describe("POST /sessions", () => {
  test("creates a new session and returns id", async () => {
    const res = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.id.length).toBe(36); // UUID format
  });

  test("health check shows session count incremented by 1", async () => {
    const beforeRes = await fetch(`${baseUrl}/health`);
    const before = await beforeRes.json();

    await fetch(`${baseUrl}/sessions`, { method: "POST" });

    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    expect(body.sessions).toBe(before.sessions + 1);
  });
});

describe("GET /sessions/:id", () => {
  test("returns session info for existing session", async () => {
    const createRes = await fetch(`${baseUrl}/sessions`, { method: "POST" });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/sessions/${id}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.exists).toBe(true);
  });

  test("returns 404 for non-existent session", async () => {
    const res = await fetch(`${baseUrl}/sessions/non-existent-id`);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Session not found");
  });
});

describe("DELETE /sessions/:id", () => {
  test("deletes existing session", async () => {
    const createRes = await fetch(`${baseUrl}/sessions`, { method: "POST" });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/sessions/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("Session deleted");

    // Verify session is gone
    const getRes = await fetch(`${baseUrl}/sessions/${id}`);
    expect(getRes.status).toBe(404);
  });

  test("returns 404 for non-existent session", async () => {
    const res = await fetch(`${baseUrl}/sessions/non-existent-id`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

describe("POST /sessions/:id/prompt", () => {
  test("sends prompt to existing session", async () => {
    const createRes = await fetch(`${baseUrl}/sessions`, { method: "POST" });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/sessions/${id}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What is 2+2?" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Prompt sent");
    expect(body.id).toBe(id);
  });

  test("returns 404 for non-existent session", async () => {
    const res = await fetch(`${baseUrl}/sessions/non-existent-id/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 400 for missing prompt", async () => {
    const createRes = await fetch(`${baseUrl}/sessions`, { method: "POST" });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/sessions/${id}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing 'prompt' in request body");
  });
});

// ---------------------------------------------------------------------------
// Events Stream
// ---------------------------------------------------------------------------

describe("GET /sessions/:id/events", () => {
  test("returns 404 for non-existent session", async () => {
    const res = await fetch(`${baseUrl}/sessions/non-existent-id/events`);
    expect(res.status).toBe(404);
  });

  test("returns SSE stream headers for existing session", async () => {
    const createRes = await fetch(`${baseUrl}/sessions`, { method: "POST" });
    const { id } = await createRes.json();

    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/sessions/${id}/events`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
    
    // Abort immediately to close the SSE connection
    controller.abort();
  });
});

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------

describe("Unknown routes", () => {
  test("returns 404 for unknown endpoints", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  test("returns 404 for wrong method on existing path", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
