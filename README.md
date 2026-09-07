# pi-headroom-status

Real-time [Headroom](https://github.com/headroom-ai/headroom) context-compression statusline badge, monitoring metrics, and management suite for [Pi coding agent](https://github.com/earendil-works/pi-coding-agent).

```text
⚡ Headroom: 34.7% (-18.3k · $0.18)
```

---

## Features

- **Live Statusline Badge:** Displays active token reduction percentage, tokens saved, and avoided cost in Pi's status bar.
- **Dynamic Background Polling:** Auto-refreshes metrics periodically (default 10s) and on conversation turn boundaries (`turn_end`, `agent_settled`).
- **Resilient Multi-Tier Telemetry:** Queries local Headroom proxy HTTP APIs (`/health`, `/stats`) with automatic disk fallback (`~/.headroom/savings_events.jsonl`).
- **Comprehensive Slash Command Suite:** `/headroom` with dynamic autocompletions for inspecting status, opening the web dashboard, changing formats, or toggling display.
- **Custom Agent Tool:** `headroom_status` tool allowing the LLM agent to inspect context compression efficiency and token savings on demand.
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
| `/headroom status` | Displays full proxy status, version, uptime, and detailed token breakdown |
| `/headroom savings` | Shows token savings breakdown (schemas vs messages) and cost avoidance |
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
- `detailed?: boolean` — Return formatted markdown breakdown

---

## License

MIT © [mastnacek](https://github.com/mastnacek)
