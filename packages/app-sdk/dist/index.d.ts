import type { Express, NextFunction, Request, Response } from "express";
type WebRequest = globalThis.Request;
type WebResponse = globalThis.Response;
import { type Capability, type Catalog, type JsonSchema } from "@whop-apps-gateway/protocol";
export type AppActionHandler = (args: Record<string, unknown>, ctx: {
    token: string;
    path?: string;
}) => Promise<unknown> | unknown;
/**
 * One action the app advertises on GET /gateway/actions and runs on POST /gateway/invoke.
 * `description` is when-to-use text for the gateway/host. Apps are not plugins — do not ship Skill files.
 */
export type RegisteredAction = {
    title: string;
    description: string;
    inputSchema: JsonSchema;
    destructive: boolean;
    handler: AppActionHandler;
};
export type CreateWhopGatewayAppOptions = {
    appId: string;
    name: string;
    publicBaseUrl: string;
    actions?: Record<string, RegisteredAction>;
    /**
     * Local/mock only: if set, only this bearer is accepted.
     * Production apps must treat `Authorization: Bearer` as the **user's Whop access token**
     * and introspect it themselves. This SDK does not introspect Whop tokens in v1.
     * When unset, any non-empty bearer is accepted as long as `X-Whop-Gateway` is present.
     */
    expectedToken?: string;
};
export declare function capabilityFor(options: CreateWhopGatewayAppOptions): Capability;
export declare function catalogFor(options: CreateWhopGatewayAppOptions): Catalog;
export declare function requireGatewayAuth(expectedToken?: string): (req: Request, res: Response, next: NextFunction) => void;
export type WhopGatewayHandlers = {
    wellKnown: (request: WebRequest) => Promise<WebResponse>;
    actions: (request: WebRequest) => Promise<WebResponse>;
    invoke: (request: WebRequest) => Promise<WebResponse>;
};
/** Fetch handlers for Next.js App Router and any host that uses the Web Request API. */
export declare function createWhopGatewayHandlers(options: CreateWhopGatewayAppOptions): WhopGatewayHandlers;
export declare function mountWhopGateway(app: Express, options: CreateWhopGatewayAppOptions): Capability;
export declare function createWhopGatewayApp(options: CreateWhopGatewayAppOptions): {
    app: Express;
    capability: Capability;
    catalog: Catalog;
};
export {};
//# sourceMappingURL=index.d.ts.map