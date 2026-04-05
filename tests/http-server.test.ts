/**
 * HTTP API Tests
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetState,
} from "../api/http-server.ts";

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
// POST /pi
// ---------------------------------------------------------------------------

describe("POST /pi", () => {
  test("creates session and sends first prompt, returns id", async () => {
    const res = await fetch(`${baseUrl}/pi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What is 2+2?", timeout: 5000 }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    // Note: eventCount may be 0 if session times out
  });

  test("returns 400 for missing prompt", async () => {
    const res = await fetch(`${baseUrl}/pi`, {
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
// POST /pi-reply
// ---------------------------------------------------------------------------

describe("POST /pi-reply", () => {
  test("sends reply to specified session", async () => {
    // First create a session with short timeout
    const createRes = await fetch(`${baseUrl}/pi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello", timeout: 5000 }),
    });
    const { id } = await createRes.json();

    // Then reply to that session
    const res = await fetch(`${baseUrl}/pi-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, prompt: "Continue", timeout: 5000 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
  }, 30000);

  test("returns 404 for non-existent session", async () => {
    const res = await fetch(`${baseUrl}/pi-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "non-existent-id", prompt: "test" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Session not found");
  });

  test("returns 400 for missing id", async () => {
    const res = await fetch(`${baseUrl}/pi-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing 'id' in request body");
  });

  test("returns 400 for missing prompt", async () => {
    // First create a session
    const createRes = await fetch(`${baseUrl}/pi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello", timeout: 5000 }),
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/pi-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing 'prompt' in request body");
  });
});

// ---------------------------------------------------------------------------
// OpenAPI Spec Endpoints
// ---------------------------------------------------------------------------

describe("GET /openapi.yaml", () => {
  test("returns OpenAPI spec as YAML", async () => {
    const res = await fetch(`${baseUrl}/openapi.yaml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("x-yaml");
    const text = await res.text();
    expect(text).toContain("openapi:");
    expect(text).toContain("/pi");
  });
});

describe("GET /openapi.json", () => {
  test("returns OpenAPI spec as JSON", async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths).toBeDefined();
    expect(body.paths["/pi"]).toBeDefined();
    expect(body.paths["/pi-reply"]).toBeDefined();
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
    const res = await fetch(`${baseUrl}/pi`, { method: "GET" });
    expect(res.status).toBe(404);
  });
});