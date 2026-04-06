# Ra HTTP API

REST API for session management.

## Quick Start

```bash
# Start the server
bun run start

# Create session + send first prompt
curl -X POST http://localhost:3000/ra \
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

### POST /ra

Create a new session and send the first prompt. Returns the session ID and the agent's text response.

**Request:**

```bash
curl -X POST http://localhost:3000/ra \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What files are in my project?"}'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send |
| `provider` | string | No | Model provider (e.g., "anthropic") |
| `model` | string | No | Model name (e.g., "claude-3-5-sonnet-20241022") |
| `thinkingLevel` | string | No | Thinking level: "off", "low", "medium", "high" |

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Based on my analysis, the current directory contains:\n\n- api/\n- examples/\n- static/\n- tests/"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Session ID for subsequent requests |
| `response` | string | The agent's text response |

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Missing `prompt` or invalid parameters |
| `500` | Internal error |

---

### POST /ra-reply

Send a continuation prompt to an existing session.

**Request:**

```bash
curl -X POST http://localhost:3000/ra-reply \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-...", "prompt": "Continue with the next step"}'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Session ID to continue |
| `prompt` | string | Yes | The continuation prompt |

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "response": "I'll continue with the next step..."
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

### GET /health

Health check endpoint.

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "status": "ok",
  "activeSessions": 0
}
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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOME` | System | User home (for `~/.pi/agent` config) |
| `PI_AGENT_DIR` | `~/.pi/agent` | Override agent configuration directory |

---

## OpenAPI Spec

The full OpenAPI 3.1 specification is available at `/openapi.yaml` or `/openapi.json` when the server is running.
