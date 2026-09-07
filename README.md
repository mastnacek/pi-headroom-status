# pi-headroom-status

Real-time [Headroom](https://github.com/headroom-ai/headroom) context-compression statusline badge, monitoring metrics, and management suite for [Pi coding agent](https://github.com/earendil-works/pi-coding-agent).

```text
⚡ Headroom: 34.7% (-18.3k · $0.18)
```

---

## Features

- **Live Statusline Badge:** Displays active token reduction percentage, tokens saved, and avoided cost in Pi's status bar. Supports both session-scoped and lifetime metrics.
- **Session-Level Savings Tracking:** Automatically captures baseline on session start and tracks exact tokens saved and dollars avoided for the active Pi session with automatic disk fallback.
- **Dynamic Background Polling:** Auto-refreshes metrics periodically (default 10s) and on conversation turn boundaries (`turn_end`, `agent_settled`).
- **Resilient Multi-Tier Telemetry:** Queries local Headroom proxy HTTP APIs (`/health`, `/stats`) with automatic disk fallback (`~/.headroom/savings_events.jsonl`).
- **Comprehensive Slash Command Suite:** `/headroom` with dynamic autocompletions for session reports, switching scopes, opening the web dashboard, changing formats, or resetting baselines.
- **Custom Agent Tool:** `headroom_status` tool allowing the LLM agent to inspect context compression efficiency and token savings on demand (with `session`, `lifetime`, or `both` scopes).
- **Multi-Level Configuration:** Supports session, project (`.pi/headroom-status.json`), and global (`~/.pi/agent/headroom-status.json`) configurations.

---

## Installation

### Method 1: Install via Pi Package Manager

```bash
pi install npm:pi-headroom-status
# Or via git:
pi install git:github.com/mastnacek/pi-headroom-status
```

### Method 2: Register in `settings.json`

Add to `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    "D:/01_programovani/pi/plugins/pi-headroom-status"
  ]
}
```

---

## Slash Commands (`/headroom`)

| Command | Description |
| :--- | :--- |
| `/headroom session` | Displays token savings, compression ratio, and cost avoided for the current session |
| `/headroom status` | Displays full proxy status, session metrics, and lifetime token breakdown |
| `/headroom savings` | Shows token savings breakdown (schemas vs messages) and cost avoidance |
| `/headroom scope <session\|lifetime>` | Switches statusline badge scope between current session and lifetime |
| `/headroom reset-session` | Resets current session baseline counter to now |
| `/headroom dashboard` | Opens Headroom's web dashboard (`http://localhost:8787/dashboard`) in default browser |
| `/headroom refresh` | Forces immediate HTTP probe and updates the statusline badge |
| `/headroom on` \| `off` | Enables or disables the statusline badge (append `--global` for persistence) |
| `/headroom format <compact\|normal\|detailed>` | Switches statusline badge rendering format |
| `/headroom port <number>` | Configures Headroom proxy port (default: `8787`) |
| `/headroom help` | Displays interactive reference guide and current metrics overview |

---

## Formats

1. **Compact:**

   ```text
   ⚡ 34.7% (-18.3k · $0.18)
   ```

2. **Normal (Default):**

   ```text
   ⚡ Headroom: 34.7% (-18.3k · $0.18)
   ```

3. **Detailed:**

   ```text
   ⚡ Headroom v0.37.0: 34.7% (-18.3k · $0.18) · 3 reqs
   ```

---

## Configuration

Stored under `.pi/headroom-status.json` or `~/.pi/agent/headroom-status.json`:

```json
{
  "enabled": true,
  "host": "127.0.0.1",
  "port": 8787,
  "pollIntervalMs": 10000,
  "format": "normal",
  "scope": "session",
  "showDollars": true,
  "showTokens": true,
  "showOffline": true,
  "prefix": "⚡"
}
```

---

## Agent Tool

The plugin registers `headroom_status`:

- `refresh?: boolean` — Trigger immediate proxy probe
- `scope?: "session" | "lifetime" | "both"` — Filter metrics scope (default: `"both"`)
- `detailed?: boolean` — Return formatted markdown breakdown

---

## License

MIT © [mastnacek](https://github.com/mastnacek)
