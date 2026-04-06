/**
 * MCP Server Tests
 * 
 * Tests the MCP server via stdio using JSON-RPC protocol.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { spawn, type Subprocess } from "bun";
import { resolve } from "path";

// JSON-RPC message types
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

describe("MCP Server", () => {
  let proc: Subprocess | null = null;
  let nextId = 1;
  let responseBuffer = "";
  // @ts-ignore - Bun types
  let stdoutIterator: AsyncIterableIterator<Uint8Array> | null = null;

  async function sendRequest(req: Omit<JsonRpcRequest, "jsonrpc" | "id">, timeoutMs = 60000): Promise<JsonRpcResponse> {
    if (!proc || !proc.stdin || !proc.stdout) {
      throw new Error("Process not running");
    }

    const id = nextId++;
    const message: JsonRpcRequest = { jsonrpc: "2.0", id, ...req };

    proc.stdin.write(JSON.stringify(message) + "\n");

    // Initialize iterator on first use
    if (!stdoutIterator) {
      // @ts-ignore - Bun types
      stdoutIterator = proc.stdout[Symbol.asyncIterator]();
    }

    // Read responses until we get the one for our request
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { value, done } = await stdoutIterator.next();
      if (done || !value) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      responseBuffer += new TextDecoder().decode(value);

      // Check if we have a complete JSON line for our request
      const lines = responseBuffer.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as JsonRpcResponse;
          if (parsed.id === id) {
            // Remove processed lines from buffer
            responseBuffer = lines.slice(lines.indexOf(line) + 1).join("\n");
            return parsed;
          }
        } catch {
          // Not JSON yet, continue
        }
      }
    }
    throw new Error("Timeout waiting for response");
  }

  async function startMcpServer(): Promise<void> {
    proc = spawn({
      cmd: ["bun", "run", resolve(import.meta.dir, "../src/mcp-server.ts")],
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: process.env.HOME },
    });

    // Wait for server to initialize
    await new Promise((r) => setTimeout(r, 500));

    // Send initialize request
    await sendRequest({
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    // Send initialized notification
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  }

  async function stopMcpServer(): Promise<void> {
    if (proc) {
      proc.kill();
      proc = null;
    }
  }

  beforeAll(async () => {
    await startMcpServer();
  });

  afterAll(async () => {
    await stopMcpServer();
  });

  // ---------------------------------------------------------------------------
  // Protocol Handlers
  // ---------------------------------------------------------------------------

  describe("initialize", () => {
    test("returns server capabilities", async () => {
      const res = await sendRequest({
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      });

      expect(res.jsonrpc).toBe("2.0");
      expect(res.result).toBeDefined();
      const result = res.result as { protocolVersion: string; capabilities: Record<string, unknown>; serverInfo: { name: string; version: string } };
      expect(result.serverInfo.name).toBe("pi-coding-agent");
      expect(result.serverInfo.version).toBe("1.0.0");
      expect(result.capabilities.tools).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // tools/list
  // ---------------------------------------------------------------------------

  describe("tools/list", () => {
    test("returns all available tools", async () => {
      const res = await sendRequest({ method: "tools/list" });

      expect(res.jsonrpc).toBe("2.0");
      expect(res.result).toBeDefined();
      const result = res.result as { tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> };
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name)).toEqual(["pi", "pi-reply"]);
    });

    test("pi tool has correct schema", async () => {
      const res = await sendRequest({ method: "tools/list" });
      const result = res.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> };
      const piTool = result.tools.find((t) => t.name === "pi");
      expect(piTool).toBeDefined();
      expect(piTool!.inputSchema).toMatchObject({
        type: "object",
        properties: {
          prompt: { type: "string", description: expect.any(String) },
          timeout: { type: "number", description: expect.any(String) },
        },
        required: ["prompt"],
      });
    });

    test("pi-reply tool has correct schema", async () => {
      const res = await sendRequest({ method: "tools/list" });
      const result = res.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> };
      const piReplyTool = result.tools.find((t) => t.name === "pi-reply");
      expect(piReplyTool).toBeDefined();
      expect(piReplyTool!.inputSchema).toMatchObject({
        type: "object",
        properties: {
          id: { type: "string", description: expect.any(String) },
          prompt: { type: "string", description: expect.any(String) },
          timeout: { type: "number", description: expect.any(String) },
        },
        required: ["id", "prompt"],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // tools/call - pi
  // --------------------------------------------------------------------------

  describe("tools/call - pi", () => {
    test("creates session and returns id", async () => {
      const res = await sendRequest(
        {
          method: "tools/call",
          params: {
            name: "pi",
            arguments: { prompt: "What is 2+2?", timeout: 30000 },
          },
        },
        90000, // Test timeout > server timeout
      );

      expect(res.jsonrpc).toBe("2.0");
      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }> };
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBeDefined();
      expect(parsed.response).toBeDefined();
      expect(typeof parsed.response).toBe("string");
    }, 120000);

    test("returns error for missing prompt", async () => {
      const res = await sendRequest({
        method: "tools/call",
        params: {
          name: "pi",
          arguments: {},
        },
      });

      // MCP returns error in content for tool errors
      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string; isError?: boolean }> };
      expect(result.content[0].text).toContain("Missing 'prompt' parameter");
    });
  });

  // ---------------------------------------------------------------------------
  // tools/call - pi-reply
  // --------------------------------------------------------------------------

  describe("tools/call - pi-reply", () => {
    test("sends reply to existing session", async () => {
      // First create a session
      const createRes = await sendRequest(
        {
          method: "tools/call",
          params: {
            name: "pi",
            arguments: { prompt: "Hello", timeout: 30000 },
          },
        },
        90000,
      );
      const createResult = JSON.parse((createRes.result as { content: Array<{ text: string }> }).content[0].text);
      const sessionId = createResult.id;

      // Then reply
      const res = await sendRequest(
        {
          method: "tools/call",
          params: {
            name: "pi-reply",
            arguments: { id: sessionId, prompt: "Continue", timeout: 30000 },
          },
        },
        90000,
      );

      expect(res.jsonrpc).toBe("2.0");
      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }> };
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.id).toBe(sessionId);
    }, 180000);

    test("returns error for non-existent session", async () => {
      const res = await sendRequest({
        method: "tools/call",
        params: {
          name: "pi-reply",
          arguments: { id: "non-existent-id", prompt: "test", timeout: 5000 },
        },
      });

      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      expect(result.content[0].text).toContain("Session not found");
      expect(result.isError).toBe(true);
    });

    test("returns error for missing id", async () => {
      const res = await sendRequest({
        method: "tools/call",
        params: {
          name: "pi-reply",
          arguments: { prompt: "test", timeout: 5000 },
        },
      });

      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toContain("Missing 'id' parameter");
    });

    test("returns error for missing prompt", async () => {
      const res = await sendRequest({
        method: "tools/call",
        params: {
          name: "pi-reply",
          arguments: { id: "some-id", timeout: 5000 },
        },
      });

      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }> };
      expect(result.content[0].text).toContain("Missing 'prompt' parameter");
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown tool
  // --------------------------------------------------------------------------

  describe("tools/call - unknown tool", () => {
    test("returns error for unknown tool", async () => {
      const res = await sendRequest({
        method: "tools/call",
        params: {
          name: "unknown-tool",
          arguments: {},
        },
      });

      expect(res.result).toBeDefined();
      const result = res.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      expect(result.content[0].text).toContain("Unknown tool");
      expect(result.isError).toBe(true);
    });
  });
});