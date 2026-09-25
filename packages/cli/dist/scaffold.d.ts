import { type Catalog } from "./protocol.js";
export declare const WELL_KNOWN_RELATIVE_PATH: string;
export declare const CATALOG_RELATIVE_PATH: string;
export type InitOptions = {
    command: "init";
    dir: string;
    appId: string;
    name: string;
    publicBaseUrl: string;
};
export type ValidateOptions = {
    command: "validate";
    dir: string;
};
export type ParsedArgs = InitOptions | ValidateOptions | {
    help: true;
} | {
    error: string;
};
export type ValidateResult = {
    ok: true;
} | {
    ok: false;
    errors: string[];
};
export type RunResult = {
    code: number;
    stdout: string;
    stderr: string;
};
/** Protocol-valid catalog example (`ping`, `get`) matching Agent A's Catalog schema. */
export declare function sampleCatalog(appId: string): Catalog;
export declare function scaffoldFiles(options: InitOptions): string[];
export declare function validateDir(dir: string): ValidateResult;
export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function helpText(): string;
export declare function run(argv: string[]): RunResult;
//# sourceMappingURL=scaffold.d.ts.map