import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";

import type { Framework } from "./detect.js";

const HERMES_DIR = path.join(os.homedir(), ".hermes");
const OPENCLAW_DIR = path.join(os.homedir(), ".openclaw");

// ---------------------------------------------------------------------------
// Whitelisted action maps
// ---------------------------------------------------------------------------

const HERMES_ACTIONS: Record<string, string> = {
  "restart-gateway": "pkill -f 'hermes.*gateway' || true && hermes gateway start",
  "prune-sessions": `find ${HERMES_DIR}/sessions -name '*.json' -mtime +30 -delete 2>/dev/null || true`,
  "checkpoint-wal": `sqlite3 ${HERMES_DIR}/state.db 'PRAGMA wal_checkpoint(TRUNCATE);' 2>/dev/null || true`,
  "kill-port-conflict": "lsof -ti:8642 | xargs kill -9 2>/dev/null || true",
  "clean-logs": `find ${HERMES_DIR}/logs -name '*.log' -mtime +7 -delete 2>/dev/null || true`,
};

const OPENCLAW_ACTIONS: Record<string, string> = {
  "restart-daemon": "pkill -f 'openclaw.*daemon' || true && openclaw daemon start",
  "prune-sessions": `find ${OPENCLAW_DIR} -name '*.jsonl' -mtime +30 -delete 2>/dev/null || true`,
  "kill-port-conflict": "lsof -ti:18789 | xargs kill -9 2>/dev/null || true",
  "clean-logs": `find ${OPENCLAW_DIR}/logs -name '*.log' -mtime +7 -delete 2>/dev/null || true`,
  "fix-context-window": `find ${OPENCLAW_DIR} -name '*.jsonl' -size +50M -exec truncate -s 0 {} \\; 2>/dev/null || true`,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listRepairActions(framework: Framework): string[] {
  const actions = framework === "hermes" ? HERMES_ACTIONS : OPENCLAW_ACTIONS;
  return Object.keys(actions);
}

export function getActionCommand(action: string, framework: Framework): string | null {
  const actions = framework === "hermes" ? HERMES_ACTIONS : OPENCLAW_ACTIONS;
  return actions[action] || null;
}

export function executeRepair(action: string, framework: Framework): { success: boolean; output: string } {
  const command = getActionCommand(action, framework);
  if (!command) {
    return { success: false, output: `Unknown action: ${action}` };
  }

  try {
    const output = execSync(command, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, output: output.trim() || "Action completed successfully" };
  } catch (err: any) {
    return { success: false, output: err.stderr || err.message || "Action failed" };
  }
}
