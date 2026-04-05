# Pi Coding Agent MCP Server

The MCP server exposes two tools via stdio for Model Context Protocol clients.

## Setup

### Configuration

Add to your MCP client config (e.g., Claude Desktop, Cursor, etc.):

```json
"mcpServers": {
  "pi-coding-agent": {
    "command": "bun",
    "args": ["run", "api/mcp-server.ts"],
    "cwd": "/path/to/pi-sdk-demo"
  }
}
```

Or run standalone:

```bash
bun run start:mcp
```

---

## Tools

### `pi`

Create a new session and send the first prompt. Returns the session ID.

**Arguments:**

```json
{
  "prompt": "List all TypeScript files in this project",
  "timeout": 120000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send to the agent |
| `timeout` | number | No | Timeout in ms (default: 120000, max: 600000) |

**Response:**

```json
{
  "content": [{
    "type": "text",
    "text": "{\"id\":\"550e8400-e29b-41d4-a716-446655440000\",\"events\":[...],\"eventCount\":15}"
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
| `timeout` | number | No | Timeout in ms (default: 120000, max: 600000) |

**Response:**

```json
{
  "content": [{
    "type": "text",
    "text": "{\"id\":\"550e8400-...\",\"events\":[...],\"eventCount\":8}"
  }]
}
```

---

## Response Format

The response body contains a JSON string with:

```json
{
  "id": "session-uuid",
  "events": [...],
  "eventCount": 15
}
```

### Event Types

| Type | Description |
|------|-------------|
| `thinking` | Agent is processing |
| `message_update` | Text delta or full message (e.g., `text_delta`) |
| `tool_call` | Tool invocation (read, bash, edit, etc.) |
| `tool_result` | Tool execution result |
| `message` | Full message (legacy format) |
| `error` | Error occurred |
| `done` | Agent finished |

### Example Event

```json
{
  "type": "message",
  "data": {
    "content": "Here's what I found..."
  }
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