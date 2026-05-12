import type { Framework } from "./detect.js";
export declare function listRepairActions(framework: Framework): string[];
export declare function getActionCommand(action: string, framework: Framework): string | null;
export declare function executeRepair(action: string, framework: Framework): {
    success: boolean;
    output: string;
};
