export type Framework = "hermes" | "openclaw";
export interface ProbeResult {
    probe: string;
    success: boolean;
    latencyMs: number;
    output: string;
    error: string | null;
}
export interface RuntimeHealth {
    processAlive: boolean;
    pid: number | null;
    uptimeSeconds: number | null;
}
export interface GatewayHealth {
    alive: boolean;
    port: number;
    latencyMs: number | null;
}
export interface IntegrationHealth {
    type: string;
    connected: boolean;
    tokenExpiresAt: string | null;
    lastMessageAt: string | null;
    error: string | null;
}
export interface CronJobHealth {
    id: string;
    expression: string;
    timezone: string | null;
    lastRun: string | null;
    lastStatus: "success" | "error" | "unknown";
    lastError: string | null;
    nextRun: string | null;
    deliveryTarget: string | null;
}
export interface MemoryHealth {
    type: "file" | "sqlite" | "honcho" | "mem0" | "zep" | "none";
    entryCount: number;
    storeReachable: boolean;
    lastWrite: string | null;
    sizeBytes: number;
}
export interface ModelHealth {
    provider: string;
    modelId: string;
    apiReachable: boolean;
    authValid: boolean;
    latencyMs: number | null;
}
export interface DiskHealth {
    homeDirMb: number;
    sessionsMb: number;
    logsMb: number;
    totalMb: number;
}
export interface PersonalityHealth {
    file: string;
    exists: boolean;
    lastModified: string | null;
    wordCount: number;
}
export interface SessionHealth {
    totalCount: number;
    oldestTimestamp: string | null;
    newestTimestamp: string | null;
    olderThan30Days: number;
    totalSizeMb: number;
}
export interface LogAnalysis {
    totalErrors: number;
    totalWarnings: number;
    topErrors: Array<{
        pattern: string;
        count: number;
        lastSeen: string;
    }>;
    errorRate: string;
}
export interface SkillValidation {
    name: string;
    hasDefinition: boolean;
    isEmpty: boolean;
    referencedInSoul: boolean;
}
export interface WorkspaceHealth {
    files: Record<string, {
        exists: boolean;
        wordCount: number;
        lineCount: number;
        sizeBytes: number;
        lastModified: string | null;
    }>;
    skills: {
        count: number;
        names: string[];
        validation: SkillValidation[];
    };
    pipeline: {
        exists: boolean;
        stageCount: number;
    };
}
export interface HealthReport {
    agentId: string;
    framework: Framework;
    version: string | null;
    host: string;
    timestamp: string;
    runtime: RuntimeHealth;
    gateway: GatewayHealth;
    integrations: IntegrationHealth[];
    crons: CronJobHealth[];
    memory: MemoryHealth;
    model: ModelHealth;
    disk: DiskHealth;
    personality: PersonalityHealth;
    configSnapshot: Record<string, unknown> | null;
    workspace: WorkspaceHealth | null;
    logsTail: string | null;
    sessions: SessionHealth;
    logAnalysis: LogAnalysis;
    probes: ProbeResult[];
    fileContents?: Record<string, string>;
}
export declare function collectHealth(framework: Framework): Promise<HealthReport>;
