import * as fs from "fs";
import * as path from "path";
import * as os from "os";
// ---------------------------------------------------------------------------
// File content collection -- workspace files for the hospital to examine
// ---------------------------------------------------------------------------
export function collectFileContents(framework) {
    const files = {};
    const homeDir = os.homedir();
    const readSafe = (p) => {
        try {
            return fs.readFileSync(p, "utf-8");
        }
        catch {
            return null;
        }
    };
    if (framework === "openclaw") {
        const configPath = path.join(homeDir, ".openclaw", "openclaw.json");
        const content = readSafe(configPath);
        if (content) {
            // Redact API keys
            files["openclaw.json"] = content.replace(/(key|token|secret|password)["']?\s*[:=]\s*["'][^"']+["']/gi, '$1: "[REDACTED]"');
        }
        // Find workspace directories
        const baseDir = path.join(homeDir, ".openclaw");
        const workspaceDirs = [
            path.join(baseDir, "workspace"),
            ...(() => {
                try {
                    return fs
                        .readdirSync(baseDir)
                        .filter((d) => d.startsWith("workspace-"))
                        .map((d) => path.join(baseDir, d));
                }
                catch {
                    return [];
                }
            })(),
        ];
        for (const wsDir of workspaceDirs) {
            for (const fname of ["SOUL.md", "TOOLS.md", "MEMORY.md", "USER.md", "IDENTITY.md"]) {
                const fp = path.join(wsDir, fname);
                const c = readSafe(fp);
                if (c)
                    files[fname] = c;
            }
        }
    }
    else {
        // Hermes
        const configPath = path.join(homeDir, ".hermes", "config.yaml");
        const content = readSafe(configPath);
        if (content) {
            files["config.yaml"] = content.replace(/(key|token|secret|password)\s*:\s*.+/gi, "$1: [REDACTED]");
        }
        const hermesDir = path.join(homeDir, ".hermes");
        for (const fname of ["SOUL.md", "TOOLS.md", "USER.md", "IDENTITY.md"]) {
            const c = readSafe(path.join(hermesDir, fname)) || readSafe(path.join(hermesDir, "memory", fname));
            if (c)
                files[fname] = c;
        }
        const memMd = readSafe(path.join(hermesDir, "memory", "MEMORY.md"));
        if (memMd)
            files["MEMORY.md"] = memMd;
    }
    return files;
}
