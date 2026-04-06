# ra

Remote Agents over HTTP/MCP.

## Quick Start

### Setup

```bash
# Set your API key
export MINIMAX_API_KEY=your_api_key_here
```

### CLI

```bash
# Install as global tool (after npm link)
ra serve          # Start HTTP API server on port 3000
ra mcp            # Start MCP server on stdio
ra --help         # Show help
```

### HTTP API

```bash
# Start the server
bun run start

# Health check
curl http://localhost:3000/health

# Create session
curl -X POST http://localhost:3000/ra \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'

# Continue conversation
curl -X POST http://localhost:3000/ra-reply \
  -H "Content-Type: application/json" \
  -d '{"id":"session-id","prompt":"Explain that answer"}'
```

### MCP Server

Configure in your MCP client (e.g., Claude Desktop, Cursor):

```json
"mcpServers": {
  "ra": {
    "command": "bun",
    "args": ["run", "src/mcp-server.ts"],
    "cwd": "/path/to/ra"
  }
}
```

---

## Features

- **Session management**: Create sessions, continue conversations
- **Model selection**: Specify provider/model via API parameters
- **Thinking levels**: Control thinking (off, low, medium, high)
- **MCP integration**: Works with any MCP-compatible client

---

## Documentation

- [HTTP API](docs/http.md) - REST API endpoints and usage
- [MCP Server](docs/mcp.md) - Model Context Protocol integration
- [Docker](docs/docker.md) - Run in Docker

---

## Examples

```bash
bun run examples/sdk/01-minimal.ts
bun run examples/sdk/02-multi-turn.ts
bun run examples/sdk/03-read-only.ts
bun run examples/sdk/04-enhance.ts
bun run examples/sdk/05-execute-skill.ts
bun run examples/sdk/06-skill-filtering.ts
bun run examples/sdk/07-list-extensions.ts
bun run examples/sdk/08-web-search.ts
```

| File | Description |
| ---- | ----------- |
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

---

## Development

```bash
bun run dev        # Watch mode for development
bun run start      # Start HTTP server
bun run test       # Run tests
bun run lint       # Lint code
bun run lint:fix   # Fix linting issues
```

---
