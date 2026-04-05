# Pi Coding Agent HTTP API

REST API for programmatic access to the pi-coding-agent session management.

## Quick Start

```bash
# Start the server
bun run api

# In another terminal - create a session
SESSION_ID=$(curl -s -X POST http://localhost:3000/sessions | jq -r '.id')
echo "Session: $SESSION_ID"
```

## Base URL

```
http://localhost:3000
```

## Authentication

Currently no authentication is required. Run the server behind a firewall or add your own authentication layer (e.g., nginx with Basic Auth, Cloudflare Access, etc.).

## Rate Limiting

No rate limiting is enforced. Be responsible.

---

## Endpoints

### Create Session

Create a new AI coding agent session.

```http
POST /sessions
```

**Response**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes**

| Status | Description |
|--------|-------------|
| `201` | Session created successfully |
| `500` | Internal server error |

---

### Get Session Info

Check if a session exists and get basic info.

```http
GET /sessions/{id}
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | UUID | Yes | Session identifier |

**Response**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "exists": true
}
```

**Status Codes**

| Status | Description |
|--------|-------------|
| `200` | Session found |
| `404` | Session not found |

---

### Delete Session

Permanently dispose of a session and release resources.

```http
DELETE /sessions/{id}
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | UUID | Yes | Session identifier |

**Response**

```json
{
  "message": "Session deleted"
}
```

**Status Codes**

| Status | Description |
|--------|-------------|
| `200` | Session deleted |
| `404` | Session not found |

---

### Send Prompt

Send a text prompt to an agent session.

```http
POST /sessions/{id}/prompt
Content-Type: application/json

{
  "prompt": "What files are in the current directory?"
}
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | UUID | Yes | Session identifier |

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text prompt for the agent |

**Response**

```json
{
  "message": "Prompt sent",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes**

| Status | Description |
|--------|-------------|
| `200` | Prompt sent successfully |
| `400` | Missing `prompt` field |
| `404` | Session not found |

---

### Stream Events (SSE)

Subscribe to real-time session events via Server-Sent Events.

```http
GET /sessions/{id}/events
Accept: text/event-stream
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | UUID | Yes | Session identifier |

**Response**

SSE stream with JSON events:

```
data: {"type":"thinking","data":{"text":"Thinking..."}}

data: {"type":"tool_call","data":{"name":"bash","args":{"command":"ls -la"}}}

data: {"type":"tool_result","data":{"name":"bash","result":"..."}}

data: {"type":"message","data":{"content":"Here are the files..."}}

data: {"type":"done","data":{}}
```

**Event Types**

| Type | Description |
|------|-------------|
| `thinking` | Agent is processing your prompt |
| `tool_call` | Agent invoked a tool (read, bash, edit, etc.) |
| `tool_result` | Tool execution completed |
| `message` | Agent sent a text message |
| `error` | An error occurred |
| `done` | Agent finished processing |

**Heartbeat**

The server sends a `: heartbeat` comment every 30 seconds to keep connections alive through proxies.

**Status Codes**

| Status | Description |
|--------|-------------|
| `200` | Stream established |
| `404` | Session not found |

---

### Health Check

Check server status and get basic statistics.

```http
GET /health
```

**Response**

```json
{
  "status": "ok",
  "sessions": 3
}
```

---

## Usage Examples

### Complete Workflow

```bash
# 1. Create a session
SESSION_ID=$(curl -s -X POST http://localhost:3000/sessions | jq -r '.id')
echo "Created session: $SESSION_ID"

# 2. Start event stream (in another terminal or background)
curl -N http://localhost:3000/sessions/$SESSION_ID/events &
EVENT_PID=$!

# 3. Send a prompt
curl -X POST http://localhost:3000/sessions/$SESSION_ID/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "List all files in the current directory"}'

# 4. Wait for events to stream, then clean up
sleep 10
kill $EVENT_PID 2>/dev/null

# 5. Delete the session
curl -X DELETE http://localhost:3000/sessions/$SESSION_ID
```

### JavaScript/fetch Example

```javascript
const BASE_URL = "http://localhost:3000";

// Create session
const { id: sessionId } = await fetch(`${BASE_URL}/sessions`, {
  method: "POST",
}).then((r) => r.json());

console.log("Session:", sessionId);

// Stream events
const eventSource = new EventSource(`${BASE_URL}/sessions/${sessionId}/events`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Event:", data.type, data.data);

  if (data.type === "done") {
    eventSource.close();
  }
};

// Send prompt
await fetch(`${BASE_URL}/sessions/${sessionId}/prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Create a simple Hello World program",
  }),
});
```

### Python/requests Example

```python
import requests
import json

BASE_URL = "http://localhost:3000"

# Create session
response = requests.post(f"{BASE_URL}/sessions")
session_id = response.json()["id"]
print(f"Session: {session_id}")

# Send prompt
prompt_response = requests.post(
    f"{BASE_URL}/sessions/{session_id}/prompt",
    json={"prompt": "List all TypeScript files in this project"}
)
print(f"Prompt sent: {prompt_response.json()}")

# Stream events (simple polling for demo - use SSE library in production)
# For real SSE, use the `sseclient` library or similar
```

---

## Error Responses

All errors return a JSON body with an `error` field:

```json
{
  "error": "Session not found"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (missing required fields) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOME` | System default | User home directory (for `~/.pi/agent` config) |

---

## Configuration

Sessions are initialized with settings from `~/.pi/agent`. Ensure this directory exists and contains your desired configuration (API keys, model preferences, etc.).

---

## OpenAPI Specification

An OpenAPI 3.1 specification is available at [`openapi.yaml`](./openapi.yaml). You can use it with:

- [Swagger UI](https://petstore.swagger.io/) - Paste the YAML URL
- [Redoc](https://redocly.github.io/redoc/) - For documentation rendering
- Postman - Import the specification
- Insomnia - Import the specification
