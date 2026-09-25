import { z } from "zod";
export declare const GATEWAY_NAME = "whop-apps-gateway";
export declare const PROTOCOL_VERSION: "1";
/** Public well-known document every participating Whop app must serve. */
export declare const WELL_KNOWN_PATH = "/.well-known/whop-gateway.json";
/** HTTP invoke path the gateway calls after a successful probe. */
export declare const INVOKE_PATH = "/gateway/invoke";
/** HTTP GET path that returns an app's action catalog. */
export declare const ACTIONS_PATH = "/gateway/actions";
/** Header the gateway always sends; apps must require it. */
export declare const HEADER_GATEWAY = "x-whop-gateway";
export declare const HEADER_GATEWAY_VALUE = "whop-apps-gateway";
export declare const MCP_PATH = "/mcp";
export declare const HEALTH_PATH = "/health";
export declare const TOOLS_HTTP_PATH = "/tools";
export declare const CapabilitySchema: z.ZodObject<{
    gateway: z.ZodLiteral<"whop-apps-gateway">;
    version: z.ZodLiteral<"1">;
    app_id: z.ZodString;
    name: z.ZodString;
    mcp: z.ZodString;
    invoke: z.ZodString;
    auth: z.ZodLiteral<"whop-oauth">;
}, "strip", z.ZodTypeAny, {
    gateway: "whop-apps-gateway";
    version: "1";
    app_id: string;
    name: string;
    mcp: string;
    invoke: string;
    auth: "whop-oauth";
}, {
    gateway: "whop-apps-gateway";
    version: "1";
    app_id: string;
    name: string;
    mcp: string;
    invoke: string;
    auth: "whop-oauth";
}>;
export type Capability = z.infer<typeof CapabilitySchema>;
export declare const WhopAppRefSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    hosted_url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    hosted_url: string;
}, {
    name: string;
    id: string;
    hosted_url: string;
}>;
export type WhopAppRef = z.infer<typeof WhopAppRefSchema>;
export declare const InvokeRequestSchema: z.ZodObject<{
    action: z.ZodString;
    arguments: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: string;
    path?: string | undefined;
    arguments?: Record<string, unknown> | undefined;
}, {
    action: string;
    path?: string | undefined;
    arguments?: Record<string, unknown> | undefined;
}>;
export type InvokeRequest = z.infer<typeof InvokeRequestSchema>;
/** JSON Schema object used as an action's argument schema. */
export declare const JsonSchemaSchema: z.ZodObject<{}, "strip", z.ZodUnknown, z.objectOutputType<{}, z.ZodUnknown, "strip">, z.objectInputType<{}, z.ZodUnknown, "strip">>;
export type JsonSchema = z.infer<typeof JsonSchemaSchema>;
/** One callable action advertised by a Whop app. `description` is when-to-use text. */
export declare const ActionDefSchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    inputSchema: z.ZodObject<{}, "strip", z.ZodUnknown, z.objectOutputType<{}, z.ZodUnknown, "strip">, z.objectInputType<{}, z.ZodUnknown, "strip">>;
    destructive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    title: string;
    description: string;
    inputSchema: {} & {
        [k: string]: unknown;
    };
    destructive: boolean;
}, {
    name: string;
    title: string;
    description: string;
    inputSchema: {} & {
        [k: string]: unknown;
    };
    destructive: boolean;
}>;
export type ActionDef = z.infer<typeof ActionDefSchema>;
export declare const CatalogSchema: z.ZodObject<{
    app_id: z.ZodString;
    actions: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        inputSchema: z.ZodObject<{}, "strip", z.ZodUnknown, z.objectOutputType<{}, z.ZodUnknown, "strip">, z.objectInputType<{}, z.ZodUnknown, "strip">>;
        destructive: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }, {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    app_id: string;
    actions: {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }[];
}, {
    app_id: string;
    actions: {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }[];
}>;
export type Catalog = z.infer<typeof CatalogSchema>;
export declare const InvokeResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    app_id: z.ZodString;
    action: z.ZodString;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    app_id: string;
    action: string;
    ok: boolean;
    data?: unknown;
    error?: string | undefined;
}, {
    app_id: string;
    action: string;
    ok: boolean;
    data?: unknown;
    error?: string | undefined;
}>;
export type InvokeResponse = z.infer<typeof InvokeResponseSchema>;
export declare const GATEWAY_TOOLS: readonly ["connection_status", "discover_apps", "create_connection", "list_connections", "disconnect_app", "app_get", "app_get_data", "app_actions", "app_invoke"];
export type GatewayToolName = (typeof GATEWAY_TOOLS)[number];
export declare function wellKnownUrl(hostedUrl: string): string;
export declare function actionsUrl(hostedUrl: string): string;
export declare function parseCapability(input: unknown): Capability;
export declare function safeParseCapability(input: unknown): z.SafeParseReturnType<{
    gateway: "whop-apps-gateway";
    version: "1";
    app_id: string;
    name: string;
    mcp: string;
    invoke: string;
    auth: "whop-oauth";
}, {
    gateway: "whop-apps-gateway";
    version: "1";
    app_id: string;
    name: string;
    mcp: string;
    invoke: string;
    auth: "whop-oauth";
}>;
export declare function parseActionDef(input: unknown): ActionDef;
export declare function safeParseActionDef(input: unknown): z.SafeParseReturnType<{
    name: string;
    title: string;
    description: string;
    inputSchema: {} & {
        [k: string]: unknown;
    };
    destructive: boolean;
}, {
    name: string;
    title: string;
    description: string;
    inputSchema: {} & {
        [k: string]: unknown;
    };
    destructive: boolean;
}>;
export declare function parseCatalog(input: unknown): Catalog;
export declare function safeParseCatalog(input: unknown): z.SafeParseReturnType<{
    app_id: string;
    actions: {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }[];
}, {
    app_id: string;
    actions: {
        name: string;
        title: string;
        description: string;
        inputSchema: {} & {
            [k: string]: unknown;
        };
        destructive: boolean;
    }[];
}>;
export declare function gatewayHeaders(accessToken: string): Record<string, string>;
export declare function isGatewayRequest(headers: Record<string, string | string[] | undefined>): boolean;
export declare function bearerToken(headers: Record<string, string | string[] | undefined>): string | undefined;
export declare function loadValidFixture(): Capability;
export declare function loadValidCatalogFixture(): Catalog;
//# sourceMappingURL=index.d.ts.map