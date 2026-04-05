# Pi SDK Demo

Demonstrates programmatic usage of `@mariozechner/pi-coding-agent`.

## Run Examples

```bash
bun run examples/01-minimal.ts
bun run examples/02-multi-turn.ts
bun run examples/03-read-only.ts
bun run examples/04-enhance.ts
bun run examples/05-execute-skill.ts
bun run examples/06-skill-filtering.ts
```

## HTTP API Server

Expose pi-coding-agent as a REST API.

### Start

```bash
bun run api
```

The API runs on `http://localhost:3000`.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sessions` | Create a new agent session |
| `GET` | `/sessions/:id` | Get session info |
| `DELETE` | `/sessions/:id` | Delete/dispose session |
| `POST` | `/sessions/:id/prompt` | Send a prompt to the session |
| `GET` | `/sessions/:id/events` | SSE stream for session events |
| `GET` | `/health` | Health check |

### Usage

```bash
# Create session (returns session_id)
SESSION_ID=$(curl -s -X POST http://localhost:3000/sessions | jq -r '.id')
echo "Session: $SESSION_ID"

# Start event stream (in another terminal)
curl -N http://localhost:3000/sessions/$SESSION_ID/events

# Send prompt
curl -X POST http://localhost:3000/sessions/$SESSION_ID/prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What files are in the current directory?"}'

# Delete session
curl -X DELETE http://localhost:3000/sessions/$SESSION_ID
```

## Examples

| File | Description |
|------|-------------|
| `01-minimal.ts` | Basic session with user settings from `~/.pi/agent` |
| `02-multi-turn.ts` | Multi-turn conversation with context preservation |
| `03-read-only.ts` | Safe mode with only read tools |
| `04-enhance.ts` | Prompt enhancement via `/enhance` command from `pi-prompt-enhancer` extension |
| `05-execute-skill.ts` | Execute skills using the SDK |
| `06-skill-filtering.ts` | Filter, replace, or add custom skills |

## Links

- [pi-coding-agent](https://github.com/badlogic/pi-mono)
- [pi.dev](https://pi.dev)
