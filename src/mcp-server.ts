/**
 * Ra MCP Server
 *
 * Exposes Ra sessions as MCP tools for stdio communication.
 * Tools: pi (create session + prompt), pi-reply (continue existing session)
 */

import { join } from "node:path";
import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// In-memory session store
const sessions = new Map<
	string,
	Awaited<ReturnType<typeof createAgentSession>>["session"]
>();
const sessionResources = new Map<string, DefaultResourceLoader>();

// Current active session ID
let _activeSessionId: string | null = null;

// Create MCP server
const server = new Server(
	{
		name: "ra",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// Tool definitions
const TOOLS = [
	{
		name: "pi",
		description: "Create a new Ra session and send the first prompt",
		inputSchema: {
			type: "object",
			properties: {
				prompt: {
					type: "string",
					description: "The prompt to send to the agent",
				},
				timeout: {
					type: "number",
					description: "Timeout in ms (default: 120000)",
				},
			},
			required: ["prompt"],
		},
	},
	{
		name: "pi-reply",
		description: "Send a reply/continuation prompt to an existing session",
		inputSchema: {
			type: "object",
			properties: {
				id: { type: "string", description: "Session ID to continue" },
				prompt: {
					type: "string",
					description: "The continuation prompt to send",
				},
				timeout: {
					type: "number",
					description: "Timeout in ms (default: 120000)",
				},
			},
			required: ["id", "prompt"],
		},
	},
] as const;

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return { tools: TOOLS };
});

// Helper to execute a prompt and collect response
async function executePrompt(
	session: Awaited<ReturnType<typeof createAgentSession>>["session"],
	prompt: string,
	timeout: number,
): Promise<{ response: string; timedOut: boolean }> {
	const responseParts: string[] = [];
	let timedOut = false;

	const unsubscribe = session.subscribe((event) => {
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
	return { response: responseParts.join(""), timedOut };
}

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	try {
		if (name === "pi") {
			const prompt = args?.prompt as string;
			const timeout = (args?.timeout as number) || 120000;

			if (!prompt) {
				throw new Error("Missing 'prompt' parameter");
			}

			// Create new session (disable extensions/skills for faster startup)
			const resourceLoader = new DefaultResourceLoader({
				cwd: join(import.meta.dir, "..", ".pi"),
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			});

			await resourceLoader.reload();

			const id = crypto.randomUUID();
			const { session } = await createAgentSession({
				resourceLoader,
				sessionManager: SessionManager.inMemory(),
			});

			sessions.set(id, session);
			sessionResources.set(id, resourceLoader);
			_activeSessionId = id;

			const { response, timedOut } = await executePrompt(
				session,
				prompt,
				timeout,
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ id, response, timedOut }),
					},
				],
				isError: timedOut,
			};
		}

		if (name === "pi-reply") {
			const id = args?.id as string;
			const prompt = args?.prompt as string;
			const timeout = (args?.timeout as number) || 120000;

			if (!id) {
				throw new Error("Missing 'id' parameter");
			}
			if (!prompt) {
				throw new Error("Missing 'prompt' parameter");
			}

			if (!sessions.has(id)) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({ error: "Session not found" }),
						},
					],
					isError: true,
				};
			}

			const session = sessions.get(id)!;
			const { response, timedOut } = await executePrompt(
				session,
				prompt,
				timeout,
			);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ id, response, timedOut }),
					},
				],
				isError: timedOut,
			};
		}

		return {
			content: [{ type: "text", text: `Unknown tool: ${name}` }],
			isError: true,
		};
	} catch (error) {
		return {
			content: [{ type: "text", text: String(error) }],
			isError: true,
		};
	}
});

// Main entry point
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.log("Ra MCP Server running on stdio");
}

main().catch(console.error);
