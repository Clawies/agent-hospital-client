export type Framework = "hermes" | "openclaw";
export interface Detection {
    framework: Framework;
    configPath: string;
    workspacePath: string;
}
export declare function detectFramework(override?: string): Detection;
