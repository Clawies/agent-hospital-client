#!/usr/bin/env node

import * as os from "os";
import { detectFramework } from "./detect.js";
import { collectHealth } from "./health.js";
import { collectFileContents } from "./files.js";
import { listRepairActions, getActionCommand, executeRepair } from "./repair.js";

import type { Framework } from "./detect.js";
import type { HealthReport } from "./health.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealingDecision {
  decision: "healed" | "escalate" | "more_repairs" | "recheck_health";
  narrative: string;
  commands: Array<{
    action: string;
    description: string;
    whitelisted: boolean;
  }>;
  confidence: number;
  severity: string;
}

interface InitialHealResponse {
  apiKey?: string;
  agentId: string;
  sessionId: string;
  diagnosis: unknown;
  decision: HealingDecision;
}

interface ResultsResponse {
  decision: HealingDecision;
}

interface RepairExecResult {
  action: string;
  success: boolean;
  output: string;
}

// ---------------------------------------------------------------------------
// Arg parsing (no commander)
// ---------------------------------------------------------------------------

function parseArgs(): { url: string; framework?: string; json: boolean } | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] !== "heal") {
    printUsage();
    return null;
  }

  let url = "";
  let framework: string | undefined;
  let json = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--framework" && i + 1 < args.length) {
      framework = args[++i];
      if (framework !== "hermes" && framework !== "openclaw") {
        console.error(`Invalid framework: ${framework}. Must be "hermes" or "openclaw".`);
        return null;
      }
    } else if (!arg.startsWith("-") && !url) {
      url = arg;
    }
  }

  if (!url) {
    printUsage();
    return null;
  }

  // Strip trailing slash
  url = url.replace(/\/+$/, "");

  return { url, framework, json };
}

function printUsage(): void {
  console.error("Usage: agent-hospital-client heal <hospital-url> [--framework openclaw|hermes] [--json]");
  console.error("");
  console.error("Example:");
  console.error("  npx @agent-hospital/client heal https://hospital.example.com");
  console.error("  npx @agent-hospital/client heal http://localhost:4200 --framework openclaw --json");
}

// ---------------------------------------------------------------------------
// HTTP helpers (native fetch, Node 18+)
// ---------------------------------------------------------------------------

async function postJSON(url: string, body: unknown, apiKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Display helpers (no chalk -- plain text)
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.error(msg);
}

function logDoctor(narrative: string, severity?: string): void {
  const prefix = severity === "critical" ? "[!!!]" : severity === "warning" ? "[ ! ]" : "[ i ]";
  log("");
  log(`${prefix} Doctor: ${narrative}`);
}

function logRepairResults(results: RepairExecResult[]): void {
  for (const r of results) {
    if (r.success) {
      log(`  [OK]   ${r.action}: ${r.output}`);
    } else {
      log(`  [FAIL] ${r.action}: ${r.output}`);
    }
  }
}

function logRecommendations(commands: Array<{ action: string; description: string; whitelisted: boolean }>): void {
  const manual = commands.filter((c) => !c.whitelisted);
  if (manual.length === 0) return;
  log("");
  log("Manual recommendations (run these yourself):");
  for (const cmd of manual) {
    log(`  $ ${cmd.action}`);
    log(`    ${cmd.description}`);
  }
}

// ---------------------------------------------------------------------------
// Main heal flow
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs();
  if (!parsed) {
    process.exit(1);
  }

  const { url, json } = parsed;

  // Step 1: Detect framework
  const detection = detectFramework(parsed.framework);
  const framework: Framework = detection.framework;

  if (!json) log(`Detected framework: ${framework}`);

  // Step 2: Collect health data
  if (!json) log("Collecting health data...");
  let report: HealthReport;
  try {
    report = await collectHealth(framework);
  } catch (err: any) {
    if (json) {
      console.log(JSON.stringify({ error: "health_collection_failed", message: err.message }));
    } else {
      log(`Health collection failed: ${err.message}`);
    }
    process.exit(1);
  }

  // Step 3: Collect file contents
  if (!json) log("Collecting workspace files...");
  const fileContents = collectFileContents(framework);

  // Step 4: Get available repair actions
  const availableActions = listRepairActions(framework);

  if (!json) log("Sending to hospital...");

  // Step 5: Healing loop
  let apiKey: string | undefined;
  let sessionId: string | undefined;
  let turnCount = 0;
  const MAX_TURNS = 6;

  // Initial request payload
  let requestBody: any = {
    name: os.hostname(),
    framework,
    host: os.hostname(),
    report,
    fileContents,
    availableActions,
  };

  while (turnCount < MAX_TURNS) {
    turnCount++;

    if (!json) {
      log(turnCount === 1
        ? "Waiting for diagnosis..."
        : `Healing turn ${turnCount}: sending results to doctor...`
      );
    }

    let decision: HealingDecision;
    try {
      if (turnCount === 1) {
        const resp: InitialHealResponse = await postJSON(`${url}/api/v1/heal`, requestBody, apiKey);
        if (resp.apiKey && !apiKey) apiKey = resp.apiKey;
        if (resp.sessionId) sessionId = resp.sessionId;
        decision = resp.decision;
      } else {
        const resp: ResultsResponse = await postJSON(`${url}/api/v1/heal/results`, requestBody, apiKey);
        decision = resp.decision;
      }
    } catch (err: any) {
      if (json) {
        console.log(JSON.stringify({ error: "server_request_failed", turn: turnCount, message: err.message }));
      } else {
        log(`Turn ${turnCount} failed: ${err.message}`);
        if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) {
          log(`Cannot reach hospital server at ${url}. Is it running?`);
        }
      }
      process.exit(1);
    }

    // Handle decision
    if (decision.decision === "healed") {
      if (json) {
        console.log(JSON.stringify({
          decision: "healed",
          sessionId,
          narrative: decision.narrative,
          confidence: decision.confidence,
          turnsUsed: turnCount,
        }));
      } else {
        logDoctor(decision.narrative || "Agent is healthy.");
        log("");
        log(`Healing complete in ${turnCount} turn(s).`);
      }
      return;
    }

    if (decision.decision === "escalate") {
      if (json) {
        console.log(JSON.stringify({
          decision: "escalate",
          sessionId,
          narrative: decision.narrative,
          commands: decision.commands,
        }));
      } else {
        logDoctor(decision.narrative || "Escalation required.", "critical");
        const manualCmds = decision.commands?.filter((c) => !c.whitelisted) || [];
        if (manualCmds.length > 0) {
          log("");
          log("Recommendations:");
          for (const cmd of manualCmds) {
            log(`  $ ${cmd.action}`);
            log(`    ${cmd.description}`);
          }
        }
        log("");
        log("Healing failed -- manual intervention required");
      }
      process.exit(1);
    }

    if (decision.decision === "more_repairs" || decision.decision === "recheck_health") {
      const commands = decision.commands || [];
      const whitelisted = commands.filter((c) => c.whitelisted);
      const manual = commands.filter((c) => !c.whitelisted);

      if (!json) {
        logDoctor(decision.narrative || "Repairs prescribed.", decision.severity);
      }

      if (whitelisted.length === 0 && manual.length === 0) {
        // No commands but doctor wants more -- recheck health
        if (!json) log("  Doctor requested fresh health data...");
        const freshReport = await collectHealth(framework);
        requestBody = {
          sessionId,
          results: [],
          postRepairHealth: freshReport,
        };
        continue;
      }

      // Execute whitelisted repairs
      const results: RepairExecResult[] = [];
      if (whitelisted.length > 0) {
        if (!json) {
          log("");
          log(`Executing ${whitelisted.length} whitelisted repair(s):`);
        }

        for (const cmd of whitelisted) {
          const shellCmd = getActionCommand(cmd.action, framework);
          if (shellCmd) {
            const result = executeRepair(cmd.action, framework);
            results.push({ action: cmd.action, ...result });
          } else {
            results.push({ action: cmd.action, success: false, output: `Unknown action: ${cmd.action}` });
          }
        }

        if (!json) {
          logRepairResults(results);
          logRecommendations(commands);
        }
      } else {
        // Only manual recommendations, no auto-executable repairs
        if (json) {
          console.log(JSON.stringify({
            decision: "more_repairs",
            sessionId,
            narrative: decision.narrative,
            manualCommands: manual,
          }));
        } else {
          logRecommendations(commands);
          log("");
          log("No auto-executable repairs. Run the recommendations above manually.");
        }
        return;
      }

      // Collect post-repair health if any repair succeeded
      let postRepairHealth: HealthReport | null = null;
      if (results.some((r) => r.success)) {
        if (!json) log("Collecting post-repair health data...");
        try {
          postRepairHealth = await collectHealth(framework);
        } catch {
          if (!json) log("Post-repair health collection failed");
        }
      }

      // Send results back for next turn
      requestBody = {
        sessionId,
        results,
        postRepairHealth,
      };
      continue;
    }

    // Unknown decision
    if (json) {
      console.log(JSON.stringify({ error: "unknown_decision", decision: decision.decision }));
    } else {
      log(`Unexpected decision from hospital: ${decision.decision}`);
    }
    break;
  }

  if (turnCount >= MAX_TURNS) {
    if (json) {
      console.log(JSON.stringify({ error: "max_turns_reached", turns: MAX_TURNS }));
    } else {
      log("");
      log(`Reached maximum healing turns (${MAX_TURNS}). Please investigate manually.`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
