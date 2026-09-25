import type { RunResult } from "./scaffold.js";
export declare const DEFAULT_GATEWAY = "https://whop-apps-gateway.vercel.app";
export declare const SERVER_NAME = "whop-apps-gateway";
export type SessionFile = {
    gateway: string;
    bearer: string;
};
export type FetchLike = typeof fetch;
export declare function isConnectCommand(argv: string[]): boolean;
export declare function gatewayBase(raw: string): string;
export declare function authorizeUrl(gateway: string, cliRedirect?: string): string;
export declare function listenForSession(timeoutMs?: number): Promise<{
    redirectUrl: string;
    session: Promise<string>;
    close: () => void;
}>;
export declare function mcpEndpoint(gateway: string): string;
export declare function parseBearer(input: string): string | undefined;
export declare function sessionPath(home: string): string;
export declare function loadSession(home: string): SessionFile | undefined;
export declare function saveSession(home: string, session: SessionFile): string;
export declare function openBrowser(url: string): void;
export declare function helpText(): string;
export declare function callTool(session: SessionFile, name: string, args: Record<string, unknown>, fetchFn: FetchLike): Promise<{
    status: number;
    body: unknown;
}>;
export declare function installTargets(home: string, localDir: string | undefined): Record<"cursor" | "claude" | "codex", string>;
export declare function writeMcpConfig(home: string, session: SessionFile, clients: Array<"cursor" | "claude" | "codex">, localDir?: string): string[];
export type ConnectIo = {
    home?: string;
    fetchFn?: FetchLike;
    openBrowser?: (url: string) => void;
    onAuthorize?: (url: string) => void;
    listenForSession?: typeof listenForSession;
};
export declare function runConnect(argv: string[], io?: ConnectIo): Promise<RunResult>;
//# sourceMappingURL=connect.d.ts.map