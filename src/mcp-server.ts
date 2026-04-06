/**
 * Ra MCP Server
 *
 * Exposes Ra sessions as MCP tools for stdio communication.
 * Tools: pi (create session + prompt), pi-reply (continue existing session)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from '@mariozechner/pi-coding-agent';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface SessionEntry {
  readonly session: AgentSession;
  readonly resourceLoader: DefaultResourceLoader;
}

interface PiToolArgs {
  readonly prompt: string;
}

interface PiReplyToolArgs {
  readonly id: string;
  readonly prompt: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

const sessions = new Map<string, SessionEntry>();

// ─── MCP Server Setup ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'ra',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'pi',
    description: 'Create a new Ra session and send the first prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt to send to the agent',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'pi-reply',
    description: 'Send a reply/continuation prompt to an existing session',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Session ID to continue' },
        prompt: {
          type: 'string',
          description: 'The continuation prompt to send',
        },
      },
      required: ['id', 'prompt'],
    },
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPiCwd(): string {
  return join(__dirname, '..', '.pi');
}

/**
 * Load default provider/model from settings.json
 */
function createPiSettingsManager(): SettingsManager {
  const settingsManager = SettingsManager.inMemory({});
  const settingsPath = join(getPiCwd(), 'settings.json');
  if (existsSync(settingsPath)) {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (settings.defaultProvider) {
      settingsManager.setDefaultProvider(settings.defaultProvider);
    }
    if (settings.defaultModel) {
      settingsManager.setDefaultModel(settings.defaultModel);
    }
  }
  return settingsManager;
}

// Helper to execute a prompt and collect response
async function executePrompt(
  session: AgentSession,
  prompt: string,
): Promise<{ response: string }> {
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

  return { response: responseParts.join('') };
}

// ─── Request Handlers ──────────────────────────────────────────────────────────

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === 'pi') {
      const { prompt } = args as unknown as PiToolArgs;

      if (!prompt) {
        throw new Error("Missing 'prompt' parameter");
      }

      // Create new session (disable extensions/skills for faster startup)
      const resourceLoader = new DefaultResourceLoader({
        cwd: getPiCwd(),
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
        settingsManager: createPiSettingsManager(),
      });

      sessions.set(id, { session, resourceLoader });

      const { response } = await executePrompt(session, prompt);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id, response }),
          },
        ],
        isError: false,
      };
    }

    if (name === 'pi-reply') {
      const { id, prompt } = args as unknown as PiReplyToolArgs;

      if (!id) {
        throw new Error("Missing 'id' parameter");
      }
      if (!prompt) {
        throw new Error("Missing 'prompt' parameter");
      }

      const entry = sessions.get(id);
      if (!entry) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Session not found' }),
            },
          ],
          isError: true,
        };
      }

      const { response } = await executePrompt(entry.session, prompt);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id, response }),
          },
        ],
        isError: false,
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: String(error) }],
      isError: true,
    };
  }
});

// ─── Main Entry Point ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Ra MCP Server running on stdio');
}

main().catch(console.error);
