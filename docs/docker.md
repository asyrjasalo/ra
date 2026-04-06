# Docker

Run the Ra HTTP API server in a container.

## Prerequisites

- Docker
- `MINIMAX_API_KEY` environment variable set

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Set your API key
export MINIMAX_API_KEY=your_api_key_here

# Start the server
docker compose up

# Test
curl http://localhost:3000/health
```

### Using Docker Directly

```bash
# Build the image
docker build -t ra .

# Run the container
docker run --rm -p 3000:3000 -e MINIMAX_API_KEY=your_api_key_here ra

# Test
curl http://localhost:3000/health
```

## Configuration

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `MINIMAX_API_KEY` | API key for the AI provider | Yes |
| `PORT` | Server port (default: 3000) | No |

## Endpoints

Once running, the API is available at `http://localhost:3000`:

- `POST /ra` - Create session and send prompt
- `POST /ra-reply` - Continue conversation
- `GET /openapi.yaml` - OpenAPI spec
- `GET /openapi.json` - OpenAPI spec (JSON)
- `GET /health` - Health check

## Examples

```bash
# Health check
curl http://localhost:3000/health
# Response: {"status":"ok"}

# Create session
curl -X POST http://localhost:3000/ra \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
# Response: {"id":"uuid","response":"2 + 2 = 4"}

# Continue conversation
curl -X POST http://localhost:3000/ra-reply \
  -H "Content-Type: application/json" \
  -d '{"id":"session-uuid","prompt":"Explain that answer"}'
```

## Stopping

```bash
# If using docker compose
docker compose down

# If using docker directly
docker stop ra
```
