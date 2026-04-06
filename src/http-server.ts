/**
 * Ra Coding Agent HTTP API Server
 *
 * REST API mirrors MCP tools: /ra (create + prompt), /ra-reply (continue)
 * Uses Hono for high-performance HTTP handling
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	ModelRegistry,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Hono } from "hono";

const PORT = parseInt(process.env.PORT || "3000", 10);

const sessions = new Map<
	string,
	Awaited<ReturnType<typeof createAgentSession>>["session"]
>();
const sessionResources = new Map<string, DefaultResourceLoader>();

let _activeSessionId: string | null = null;

export function resetState() {
	for (const session of sessions.values()) {
		session.dispose();
	}
	sessions.clear();
	sessionResources.clear();
	_activeSessionId = null;
}

import type { Server } from "node:http";

let server: Server | null = null;

export async function startServer(port = PORT): Promise<Server> {
	const app = new Hono();

	// Middleware for JSON body parsing
	app.use("*", async (c, next) => {
		if (c.req.method === "POST" || c.req.method === "PUT") {
			try {
				const body = await c.req.json();
				c.set("body", body);
			} catch {
				c.set("body", {});
			}
		}
		await next();
	});

	// Route: POST /ra - Create new session + send first prompt
	app.post("/ra", async (c) => {
		const body = c.get("body") as Record<string, unknown>;
		const result = await handlePi(body);
		return c.json(result.body, result.status);
	});

	// Route: POST /ra-reply - Send prompt to existing session
	app.post("/ra-reply", async (c) => {
		const body = c.get("body") as Record<string, unknown>;
		const result = await handlePiReply(body);
		return c.json(result.body, result.status);
	});

	// Route: GET /openapi.yaml - Return OpenAPI spec as YAML
	app.get("/openapi.yaml", (c) => {
		const spec = readFileSync(
			join(import.meta.dir, "..", "static", "openapi.yaml"),
			"utf-8",
		);
		return c.body(spec, 200, { "Content-Type": "application/x-yaml" });
	});

	// Route: GET /openapi.json - Return OpenAPI spec as JSON
	app.get("/openapi.json", (c) => {
		const spec = readFileSync(
			join(import.meta.dir, "..", "static", "openapi.yaml"),
			"utf-8",
		);
		const json = yamlToJson(spec);
		return c.body(json, 200, { "Content-Type": "application/json" });
	});

	// Route: GET /health - Health check
	app.get("/health", (c) => {
		return c.json({ status: "ok", activeSessions: sessions.size });
	});

	// Custom 404 handler - return JSON for unmatched routes
	app.notFound((c) => {
		return c.json({ error: "Not found" }, 404);
	});

	return new Promise((resolve, reject) => {
		server = serve({
			fetch: app.fetch,
			port,
		});
		server.on("error", reject);
		server.on("listening", () => resolve(server!));
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

// Simple YAML to JSON converter for the OpenAPI spec
function yamlToJson(yaml: string): string {
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
		else if (value.startsWith('"') && value.endsWith('"'))
			value = value.slice(1, -1);
		else if (value.startsWith("'") && value.endsWith("'"))
			value = value.slice(1, -1);
		else if (value === "true") value = true;
		else if (value === "false") value = false;
		else if (!Number.isNaN(Number(value))) value = Number(value);

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

async function handlePi(
	body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
	const prompt = body.prompt as string;
	const timeout = (body.timeout as number) || 120000;
	const provider = body.provider as string | undefined;
	const modelName = body.model as string | undefined;
	const thinkingLevel = body.thinkingLevel as string | undefined;

	if (!prompt) {
		return { status: 400, body: { error: "Missing 'prompt' in request body" } };
	}

	// Validate thinking level
	const validThinkingLevels = ["off", "low", "medium", "high"];
	if (thinkingLevel && !validThinkingLevels.includes(thinkingLevel)) {
		return {
			status: 400,
			body: {
				error: `Invalid 'thinkingLevel'. Must be one of: ${validThinkingLevels.join(", ")}`,
			},
		};
	}

	const resourceLoader = new DefaultResourceLoader({
		cwd: join(import.meta.dir, "..", ".pi"),
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
	});

	await resourceLoader.reload();

	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);

	const sessionOptions: Record<string, unknown> = {
		resourceLoader,
		sessionManager: SessionManager.inMemory(),
		authStorage,
		modelRegistry,
	};

	// Set model if provider and model are provided
	if (provider && modelName) {
		const model = modelRegistry.find(provider, modelName);
		if (!model) {
			throw new Error(`Model ${provider}/${modelName} not found`);
		}
		sessionOptions.model = model;
	}

	// Set thinking level if provided
	if (thinkingLevel) {
		sessionOptions.thinkingLevel = thinkingLevel;
	}

	const id = crypto.randomUUID();
	const { session } = await createAgentSession(
		sessionOptions as Parameters<typeof createAgentSession>[0],
	);

	sessions.set(id, session);
	sessionResources.set(id, resourceLoader);
	_activeSessionId = id;

	const modelInfo = provider && modelName ? ` (${provider}/${modelName})` : "";
	const thinkingInfo = thinkingLevel ? ` thinking=${thinkingLevel}` : "";
	console.log(
		`[${id}] Session created${modelInfo}${thinkingInfo}, prompt: ${prompt.substring(0, 80)}...`,
	);

	const responseParts: string[] = [];
	let timedOut = false;

	const unsubscribe = session.subscribe((event) => {
		// Extract text deltas from assistant messages
		if (
			event.type === "message_update" &&
			event.assistantMessageEvent?.type === "text_delta"
		) {
			responseParts.push(event.assistantMessageEvent.delta);
		}
	});

	try {
		await Promise.race([
			session.prompt(prompt),
			new Promise((_, reject) =>
				setTimeout(() => {
					timedOut = true;
					reject(new Error("Timeout"));
				}, timeout),
			),
		]);
	} catch (_error) {
		// Timeout or other error - continue to return partial response
	}

	unsubscribe();

	const response = responseParts.join("");

	return {
		status: timedOut ? 408 : 200,
		body: { id, response, timedOut },
	};
}

async function handlePiReply(
	body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
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

	const responseParts: string[] = [];
	let timedOut = false;

	const unsubscribe = session.subscribe((event) => {
		// Extract text deltas from assistant messages
		if (
			event.type === "message_update" &&
			event.assistantMessageEvent?.type === "text_delta"
		) {
			responseParts.push(event.assistantMessageEvent.delta);
		}
	});

	try {
		await Promise.race([
			session.prompt(prompt),
			new Promise((_, reject) =>
				setTimeout(() => {
					timedOut = true;
					reject(new Error("Timeout"));
				}, timeout),
			),
		]);
	} catch (_error) {
		// Timeout or other error - continue to return partial response
	}

	unsubscribe();

	const response = responseParts.join("");

	return {
		status: timedOut ? 408 : 200,
		body: { id, response, timedOut },
	};
}

const isMain = process.argv[1]?.endsWith("api/http-server.ts");

if (isMain) {
	startServer().then(() => {
		console.log(`Ra API running at http://localhost:${PORT}`);
		console.log(
			"Endpoints: POST /ra, POST /ra-reply, GET /openapi.yaml, GET /openapi.json, GET /health",
		);
	});
}
