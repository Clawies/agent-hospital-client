# @agent-hospital/client

Zero-config health check and healing client for [Agent Hospital](https://agent-hospital.ai). Diagnoses and repairs AI agents with a single command.

## Usage

```bash
npx @agent-hospital/client heal https://api.agent-hospital.ai
```

That's it. The client will:

1. Auto-detect your agent framework (OpenClaw or Hermes)
2. Collect health data from your local environment
3. Send it to Agent Hospital for AI-powered diagnosis
4. Execute safe (whitelisted) repairs automatically
5. Report results back and repeat until healthy or escalated

## Options

```bash
npx @agent-hospital/client heal <hospital-url> [--framework openclaw|hermes] [--json]
```

| Flag | Description |
|------|-------------|
| `--framework` | Override auto-detection. Must be `openclaw` or `hermes` |
| `--json` | Output machine-readable JSON instead of human-readable text |

## What Gets Collected

The client collects a comprehensive health report from your local agent environment:

| Area | Data |
|------|------|
| Runtime | Process alive, PID, uptime |
| Gateway | Alive, port, latency |
| Integrations | Slack, Telegram, Discord, WhatsApp connectivity |
| Memory | Store reachable, entry count, size, last write |
| Model/LLM | Provider, API reachable, auth valid, latency |
| Disk | Home dir, sessions, logs, total usage |
| Workspace | SOUL.md, TOOLS.md, skills, pipeline config |
| Sessions | Count, age, total size |
| Logs | Error rate, top error patterns |
| Config | Full config snapshot (secrets redacted) |

File contents (SOUL.md, TOOLS.md, config files) are sent with secrets automatically redacted.

## Whitelisted Repairs

The client auto-executes these safe repair actions when prescribed by the doctor:

### OpenClaw

| Action | Description |
|--------|-------------|
| `restart-daemon` | Restart the OpenClaw daemon |
| `prune-sessions` | Delete sessions older than 30 days |
| `kill-port-conflict` | Kill processes blocking port 18789 |
| `clean-logs` | Delete logs older than 7 days |
| `fix-context-window` | Truncate oversized .jsonl files (>50MB) |

### Hermes

| Action | Description |
|--------|-------------|
| `restart-gateway` | Restart the Hermes gateway |
| `prune-sessions` | Delete sessions older than 30 days |
| `checkpoint-wal` | Checkpoint SQLite WAL file |
| `kill-port-conflict` | Kill processes blocking port 8642 |
| `clean-logs` | Delete logs older than 7 days |

Non-whitelisted commands are shown as recommendations but never auto-executed.

## JSON Output

With `--json`, the client outputs structured JSON for programmatic use:

```bash
npx @agent-hospital/client heal https://api.agent-hospital.ai --json
```

**Healed:**
```json
{
  "decision": "healed",
  "sessionId": "uuid",
  "narrative": "All repairs succeeded. Agent is healthy.",
  "confidence": 0.92,
  "turnsUsed": 2
}
```

**Escalated:**
```json
{
  "decision": "escalate",
  "sessionId": "uuid",
  "narrative": "Cannot resolve automatically.",
  "commands": [{ "action": "...", "description": "...", "whitelisted": false }]
}
```

## How It Works

```
Client                              Agent Hospital
  |                                       |
  |-- detect framework ----------------->|
  |-- collect health data                 |
  |-- POST /api/v1/heal ---------------->|
  |                                       |-- AI diagnosis
  |<- apiKey + diagnosis + commands ------|
  |                                       |
  |-- execute whitelisted repairs         |
  |-- collect post-repair health          |
  |-- POST /api/v1/heal/results -------->|
  |                                       |-- AI evaluation
  |<- decision (healed/more/escalate) ---|
  |                                       |
  |   [repeat until healed or max 6 turns]
```

- No API key needed on first call -- one is generated and returned automatically
- The client stores nothing between runs -- fully stateless
- Max 6 healing turns before forced exit

## Requirements

- Node.js 18+ (uses native `fetch`)
- Zero runtime dependencies

## Development

```bash
git clone git@github.com:Clawies/agent-hospital-client.git
cd agent-hospital-client
npm install
npm run build
```

## License

MIT
