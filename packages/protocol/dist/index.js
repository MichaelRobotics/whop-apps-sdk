import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
export const GATEWAY_NAME = "whop-apps-gateway";
export const PROTOCOL_VERSION = "1";
/** Public well-known document every participating Whop app must serve. */
export const WELL_KNOWN_PATH = "/.well-known/whop-gateway.json";
/** HTTP invoke path the gateway calls after a successful probe. */
export const INVOKE_PATH = "/gateway/invoke";
/** HTTP GET path that returns an app's action catalog. */
export const ACTIONS_PATH = "/gateway/actions";
/** Header the gateway always sends; apps must require it. */
export const HEADER_GATEWAY = "x-whop-gateway";
export const HEADER_GATEWAY_VALUE = GATEWAY_NAME;
export const MCP_PATH = "/mcp";
export const HEALTH_PATH = "/health";
export const TOOLS_HTTP_PATH = "/tools";
export const CapabilitySchema = z.object({
    gateway: z.literal(GATEWAY_NAME),
    version: z.literal(PROTOCOL_VERSION),
    app_id: z.string().min(1),
    name: z.string().min(1),
    mcp: z.string().url(),
    invoke: z.string().url(),
    auth: z.literal("whop-oauth"),
});
export const WhopAppRefSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    hosted_url: z.string().url(),
});
export const InvokeRequestSchema = z.object({
    action: z.string().min(1),
    arguments: z.record(z.unknown()).optional(),
    path: z.string().optional(),
});
/** JSON Schema object used as an action's argument schema. */
export const JsonSchemaSchema = z.object({}).catchall(z.unknown());
/** One callable action advertised by a Whop app. `description` is when-to-use text. */
export const ActionDefSchema = z.object({
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    inputSchema: JsonSchemaSchema,
    destructive: z.boolean(),
});
export const CatalogSchema = z.object({
    app_id: z.string().min(1),
    actions: z.array(ActionDefSchema),
});
export const InvokeResponseSchema = z.object({
    ok: z.boolean(),
    app_id: z.string().min(1),
    action: z.string().min(1),
    data: z.unknown().optional(),
    error: z.string().optional(),
});
export const GATEWAY_TOOLS = [
    "connection_status",
    "discover_apps",
    "create_connection",
    "list_connections",
    "disconnect_app",
    "app_get",
    "app_get_data",
    "app_actions",
    "app_invoke",
];
export function wellKnownUrl(hostedUrl) {
    const base = hostedUrl.replace(/\/+$/, "");
    return `${base}${WELL_KNOWN_PATH}`;
}
export function actionsUrl(hostedUrl) {
    const base = hostedUrl.replace(/\/+$/, "");
    return `${base}${ACTIONS_PATH}`;
}
export function parseCapability(input) {
    return CapabilitySchema.parse(input);
}
export function safeParseCapability(input) {
    return CapabilitySchema.safeParse(input);
}
export function parseActionDef(input) {
    return ActionDefSchema.parse(input);
}
export function safeParseActionDef(input) {
    return ActionDefSchema.safeParse(input);
}
export function parseCatalog(input) {
    return CatalogSchema.parse(input);
}
export function safeParseCatalog(input) {
    return CatalogSchema.safeParse(input);
}
export function gatewayHeaders(accessToken) {
    return {
        authorization: `Bearer ${accessToken}`,
        [HEADER_GATEWAY]: HEADER_GATEWAY_VALUE,
        "content-type": "application/json",
        accept: "application/json",
    };
}
export function isGatewayRequest(headers) {
    const raw = headers[HEADER_GATEWAY] ?? headers["X-Whop-Gateway"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === HEADER_GATEWAY_VALUE;
}
export function bearerToken(headers) {
    const raw = headers.authorization ?? headers.Authorization;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value?.toLowerCase().startsWith("bearer "))
        return undefined;
    const token = value.slice(7).trim();
    return token || undefined;
}
export function loadValidFixture() {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(here, "..", "fixtures", "capability.valid.json");
    return parseCapability(JSON.parse(readFileSync(fixturePath, "utf8")));
}
export function loadValidCatalogFixture() {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(here, "..", "fixtures", "catalog.valid.json");
    return parseCatalog(JSON.parse(readFileSync(fixturePath, "utf8")));
}
//# sourceMappingURL=index.js.map