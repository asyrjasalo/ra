# Pi SDK Demo

Demonstrates programmatic usage of `@mariozechner/pi-coding-agent`.

## Run

```bash
bun run examples/01-minimal.ts
bun run examples/02-multi-turn.ts
bun run examples/03-read-only.ts
bun run examples/04-enhance.ts
bun run examples/05-execute-skill.ts
bun run examples/06-skill-filtering.ts
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

## Local Development Setup

Some extensions have missing peer dependencies. To enable all extensions when developing locally, create symlinks in the global `node_modules`:

```bash
GLOBAL_MODULES=$(npm root -g)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

ln -sf "$SCRIPT_DIR/node_modules/@mariozechner/pi-coding-agent" "$GLOBAL_MODULES/@mariozechner/pi-coding-agent"
ln -sf "$SCRIPT_DIR/node_modules/@mariozechner/pi-tui" "$GLOBAL_MODULES/@mariozechner/pi-tui"
ln -sf "$SCRIPT_DIR/node_modules/@mariozechner/pi-ai" "$GLOBAL_MODULES/@mariozechner/pi-ai"
ln -sf "$SCRIPT_DIR/node_modules/@sinclair/typebox" "$GLOBAL_MODULES/@sinclair/typebox"
```

## Links

- [pi-coding-agent](https://github.com/badlogic/pi-mono)
- [pi.dev](https://pi.dev)
