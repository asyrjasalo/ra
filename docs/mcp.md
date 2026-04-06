# Ra MCP Server

The MCP server exposes two tools via stdio for Model Context Protocol clients.

## Setup

### Configuration

Add to your MCP client config (e.g., Claude Desktop, Cursor, etc.):

```json
"mcpServers": {
  "ra": {
    "command": "bun",
    "args": ["run", "src/mcp-server.ts"],
    "cwd": "/path/to/ra"
  }
}
```

Or run standalone:

```bash
ra mcp
```

---

## Tools

### `pi`

Create a new session and send the first prompt. Returns the session ID and the agent's text response.

**Arguments:**

```json
{
  "prompt": "List all TypeScript files in this project",
  "timeout": 120000,
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "thinkingLevel": "high"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send to the agent |
| `timeout` | number | No | Timeout in ms (default: 120000) |
| `provider` | string | No | Model provider (e.g., "anthropic") |
| `model` | string | No | Model name (e.g., "claude-3-5-sonnet-20241022") |
| `thinkingLevel` | string | No | Thinking level: "off", "low", "medium", "high" |

**Response:**

```json
{
  "content": [{
    "type": "text",
    "text": "{\"id\":\"550e8400-e29b-41d4-a716-446655440000\",\"response\":\"Based on my analysis...\",\"timedOut\":false}"
  }]
}
```

---

### `pi-reply`

Send a continuation prompt to an existing session.

**Arguments:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "prompt": "Now refactor the core module",
  "timeout": 120000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Session ID to continue |
| `prompt` | string | Yes | The continuation prompt |
| `timeout` | number | No | Timeout in ms (default: 120000) |

**Response:**

```json
{
  "content": [{
    "type": "text",
    "text": "{\"id\":\"550e8400-...\",\"response\":\"I'll refactor the core module...\",\"timedOut\":false}"
  }]
}
```

---

## Response Format

The response body contains a JSON string with:

```json
{
  "id": "session-uuid",
  "response": "The agent's text response to the prompt",
  "timedOut": false
}
```

---

## Error Handling

Errors return `isError: true` with the error message:

```json
{
  "content": [{"type": "text", "text": "Session not found"}],
  "isError": true
}
```

---

## Session Management

Sessions are stored in-memory on the server. For long-running workflows, maintain the session ID returned by `pi` and pass it to subsequent `pi-reply` calls.

The server does not persist sessions - restart the server to clear all sessions.
