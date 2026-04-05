# Pi SDK Demo

Demonstrates programmatic usage of `@mariozechner/pi-coding-agent`.

## Quick Start

### HTTP API

```bash
# Start the server
bun run start

# Create session + send first prompt (returns session id)
curl -X POST http://localhost:3000/pi \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, help me with my project"}'

# Continue conversation with that session id
curl -X POST http://localhost:3000/pi-reply \
  -H "Content-Type: application/json" \
  -d '{"id":"session-id-here","prompt":"Continue with the next step"}'
```

### MCP Server

```bash
# Run the MCP server (stdio-based)
bun run start:mcp
```

Configure in your MCP client (e.g., Claude Desktop, Cursor):

```json
"mcpServers": {
  "pi-coding-agent": {
    "command": "bun",
    "args": ["run", "api/mcp-server.ts"],
    "cwd": "/path/to/pi-sdk-demo"
  }
}
```

---

## API Reference

- **OpenAPI Spec**: `GET /openapi.yaml` or `GET /openapi.json`

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pi` | Create session + send first prompt |
| `POST` | `/pi-reply` | Continue session with prompt |
| `GET` | `/openapi.yaml` | OpenAPI spec as YAML |
| `GET` | `/openapi.json` | OpenAPI spec as JSON |

### MCP Tools

| Tool | Description |
|------|-------------|
| `pi` | Create session + send first prompt |
| `pi-reply` | Continue session (requires session `id`) |

---

## Examples

Run the example scripts:

```bash
bun run examples/01-minimal.ts
bun run examples/02-multi-turn.ts
bun run examples/03-read-only.ts
bun run examples/04-enhance.ts
bun run examples/05-execute-skill.ts
bun run examples/06-skill-filtering.ts
bun run examples/07-list-extensions.ts
bun run examples/08-web-search.ts
```

| File | Description |
|------|-------------|
| `01-minimal.ts` | Basic session with user settings from `~/.pi/agent` |
| `02-multi-turn.ts` | Multi-turn conversation with context preservation |
| `03-read-only.ts` | Safe mode with only read tools |
| `04-enhance.ts` | Prompt enhancement via `/enhance` command |
| `05-execute-skill.ts` | Execute skills using the SDK |
| `06-skill-filtering.ts` | Filter, replace, or add custom skills |
| `07-list-extensions.ts` | List installed extensions by package |
| `08-web-search.ts` | Perform web searches via SDK |

---

## Configuration

Sessions use settings from `~/.pi/agent` by default. Override with `PI_AGENT_DIR`:

```bash
PI_AGENT_DIR=/path/to/config bun run start
```

## Tests

```bash
bun test
```

---

## Links

- [pi-coding-agent](https://github.com/badlogic/pi-mono)
- [pi.dev](https://pi.dev)