# Pi Coding Agent HTTP API

REST API for pi-coding-agent session management.

## Quick Start

```bash
# Start the server
bun run start

# Create session + send first prompt
curl -X POST http://localhost:3000/pi \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, help me with my project"}'
```

---

## Base URL

```
http://localhost:3000
```

---

## Endpoints

### POST /pi

Create a new session and send the first prompt. Returns the session ID.

**Request:**

```bash
curl -X POST http://localhost:3000/pi \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What files are in my project?", "timeout": 120000}'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send |
| `timeout` | number | No | Timeout in ms (default: 120000) |

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "events": [...],
  "eventCount": 15
}
```

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Missing `prompt` |
| `500` | Internal error |

---

### POST /pi-reply

Send a continuation prompt to an existing session.

**Request:**

```bash
curl -X POST http://localhost:3000/pi-reply \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-...", "prompt": "Continue with the next step"}'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Session ID to continue |
| `prompt` | string | Yes | The continuation prompt |
| `timeout` | number | No | Timeout in ms (default: 120000) |

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "events": [...],
  "eventCount": 8
}
```

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Missing `id` or `prompt` |
| `404` | Session not found |
| `500` | Internal error |

---

### GET /openapi.yaml

Returns the OpenAPI specification as YAML.

```bash
curl http://localhost:3000/openapi.yaml
```

---

### GET /openapi.json

Returns the OpenAPI specification as JSON.

```bash
curl http://localhost:3000/openapi.json
```

---

## Error Responses

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

## Event Types

Events returned in responses:

| Type | Description |
|------|-------------|
| `thinking` | Agent is processing |
| `tool_call` | Tool invocation (read, bash, edit, etc.) |
| `tool_result` | Tool execution result |
| `message` | Agent text response |
| `error` | Error occurred |
| `done` | Agent finished |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOME` | System | User home (for `~/.pi/agent` config) |

---

## OpenAPI Spec

The full OpenAPI 3.1 specification is available at `/openapi.yaml` or `/openapi.json` when the server is running.