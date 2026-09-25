import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const GATEWAY_NAME = "whop-apps-gateway";
export const PROTOCOL_VERSION = "1" as const;

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

export type Capability = z.infer<typeof CapabilitySchema>;

export const WhopAppRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hosted_url: z.string().url(),
});

export type WhopAppRef = z.infer<typeof WhopAppRefSchema>;

export const InvokeRequestSchema = z.object({
  action: z.string().min(1),
  arguments: z.record(z.unknown()).optional(),
  path: z.string().optional(),
});

export type InvokeRequest = z.infer<typeof InvokeRequestSchema>;

/** JSON Schema object used as an action's argument schema. */
export const JsonSchemaSchema = z.object({}).catchall(z.unknown());

export type JsonSchema = z.infer<typeof JsonSchemaSchema>;

/** One callable action advertised by a Whop app. `description` is when-to-use text. */
export const ActionDefSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  inputSchema: JsonSchemaSchema,
  destructive: z.boolean(),
});

export type ActionDef = z.infer<typeof ActionDefSchema>;

export const CatalogSchema = z.object({
  app_id: z.string().min(1),
  actions: z.array(ActionDefSchema),
});

export type Catalog = z.infer<typeof CatalogSchema>;

export const InvokeResponseSchema = z.object({
  ok: z.boolean(),
  app_id: z.string().min(1),
  action: z.string().min(1),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type InvokeResponse = z.infer<typeof InvokeResponseSchema>;

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
] as const;

export type GatewayToolName = (typeof GATEWAY_TOOLS)[number];

export function wellKnownUrl(hostedUrl: string): string {
  const base = hostedUrl.replace(/\/+$/, "");
  return `${base}${WELL_KNOWN_PATH}`;
}

export function actionsUrl(hostedUrl: string): string {
  const base = hostedUrl.replace(/\/+$/, "");
  return `${base}${ACTIONS_PATH}`;
}

export function parseCapability(input: unknown): Capability {
  return CapabilitySchema.parse(input);
}

export function safeParseCapability(input: unknown) {
  return CapabilitySchema.safeParse(input);
}

export function parseActionDef(input: unknown): ActionDef {
  return ActionDefSchema.parse(input);
}

export function safeParseActionDef(input: unknown) {
  return ActionDefSchema.safeParse(input);
}

export function parseCatalog(input: unknown): Catalog {
  return CatalogSchema.parse(input);
}

export function safeParseCatalog(input: unknown) {
  return CatalogSchema.safeParse(input);
}

export function gatewayHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    [HEADER_GATEWAY]: HEADER_GATEWAY_VALUE,
    "content-type": "application/json",
    accept: "application/json",
  };
}

export function isGatewayRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const raw = headers[HEADER_GATEWAY] ?? headers["X-Whop-Gateway"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === HEADER_GATEWAY_VALUE;
}

export function bearerToken(headers: Record<string, string | string[] | undefined>): string | undefined {
  const raw = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.toLowerCase().startsWith("bearer ")) return undefined;
  const token = value.slice(7).trim();
  return token || undefined;
}

export function loadValidFixture(): Capability {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(here, "..", "fixtures", "capability.valid.json");
  return parseCapability(JSON.parse(readFileSync(fixturePath, "utf8")));
}

export function loadValidCatalogFixture(): Catalog {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(here, "..", "fixtures", "catalog.valid.json");
  return parseCatalog(JSON.parse(readFileSync(fixturePath, "utf8")));
}
