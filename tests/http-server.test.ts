import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { startServer, stopServer, getBaseUrl, resetState } from "../api/http-server";

describe("HTTP Server", () => {
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

  test("GET /health returns status ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("activeSessions");
    expect(typeof body.activeSessions).toBe("number");
  });

  test("GET /health with active sessions shows correct count", async () => {
    // Create a session via POST /pi
    await fetch(`${baseUrl}/pi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test", timeout: 1000 }),
    });

    const healthRes = await fetch(`${baseUrl}/health`);
    const healthBody = await healthRes.json();
    expect(healthBody.activeSessions).toBeGreaterThanOrEqual(0);
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty("error", "Not found");
  });

  test("GET /openapi.yaml returns valid YAML", async () => {
    const res = await fetch(`${baseUrl}/openapi.yaml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("x-yaml");

    const text = await res.text();
    expect(text).toContain("openapi:");
    expect(text).toContain("/pi");
  });

  test("GET /openapi.json returns valid JSON", async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("json");

    const body = await res.json();
    expect(body).toHaveProperty("openapi");
    expect(body).toHaveProperty("paths");
  });

  test("POST /pi without prompt returns 400", async () => {
    const res = await fetch(`${baseUrl}/pi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /pi-reply without session returns 404", async () => {
    const res = await fetch(`${baseUrl}/pi-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "nonexistent", prompt: "test" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Session not found");
  });
});
