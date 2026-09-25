import type { Express, NextFunction, Request, Response } from "express";

type WebRequest = globalThis.Request;
type WebResponse = globalThis.Response;
import express from "express";
import AjvModule from "ajv";
import type { Options, ValidateFunction } from "ajv";
import {
  ACTIONS_PATH,
  HEADER_GATEWAY,
  HEADER_GATEWAY_VALUE,
  HEALTH_PATH,
  INVOKE_PATH,
  InvokeRequestSchema,
  MCP_PATH,
  WELL_KNOWN_PATH,
  bearerToken,
  isGatewayRequest,
  parseCapability,
  parseCatalog,
  type Capability,
  type Catalog,
  type JsonSchema,
} from "@whop-apps-gateway/protocol";

export type AppActionHandler = (
  args: Record<string, unknown>,
  ctx: { token: string; path?: string },
) => Promise<unknown> | unknown;

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

type AjvInstance = {
  compile(schema: object): ValidateFunction;
  errorsText(errors: ValidateFunction["errors"], options?: { separator?: string }): string;
};

/** NodeNext types Ajv's CJS default as the module namespace; runtime is the constructor. */
const Ajv = (
  (AjvModule as unknown as { default?: new (options?: Options) => AjvInstance }).default ??
  (AjvModule as unknown as new (options?: Options) => AjvInstance)
);

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });

function defaultActions(): Record<string, RegisteredAction> {
  return {
    ping: {
      title: "Ping",
      description: "Check that the app is reachable and the gateway session is authorized.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      destructive: false,
      handler: () => ({ pong: true }),
    },
    get: {
      title: "Get",
      description: "Fetch a resource by path when you need a document the app exposes.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Resource path",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
      destructive: false,
      handler: (args, ctx) => ({
        path: typeof args.path === "string" ? args.path : (ctx.path ?? "/"),
        stub: true,
      }),
    },
  };
}

function registeredActions(options: CreateWhopGatewayAppOptions): Record<string, RegisteredAction> {
  return options.actions ?? defaultActions();
}

export function capabilityFor(options: CreateWhopGatewayAppOptions): Capability {
  const base = options.publicBaseUrl.replace(/\/+$/, "");
  return parseCapability({
    gateway: "whop-apps-gateway",
    version: "1",
    app_id: options.appId,
    name: options.name,
    mcp: `${base}${MCP_PATH}`,
    invoke: `${base}${INVOKE_PATH}`,
    auth: "whop-oauth",
  });
}

export function catalogFor(options: CreateWhopGatewayAppOptions): Catalog {
  const actions = registeredActions(options);
  return parseCatalog({
    app_id: options.appId,
    actions: Object.entries(actions).map(([name, def]) => ({
      name,
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      destructive: def.destructive,
    })),
  });
}

export function requireGatewayAuth(expectedToken?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isGatewayRequest(req.headers)) {
      res.status(401).json({
        ok: false,
        error: `Missing ${HEADER_GATEWAY}: ${HEADER_GATEWAY_VALUE}`,
      });
      return;
    }
    const token = bearerToken(req.headers);
    if (!token) {
      res.status(401).json({ ok: false, error: "Missing Authorization Bearer" });
      return;
    }
    if (expectedToken && token !== expectedToken) {
      res.status(401).json({ ok: false, error: "Invalid access token" });
      return;
    }
    next();
  };
}

function invokeArguments(body: { arguments?: Record<string, unknown>; path?: string }): Record<string, unknown> {
  const args = { ...(body.arguments ?? {}) };
  if (body.path !== undefined && args.path === undefined) {
    args.path = body.path;
  }
  return args;
}

function formatSchemaErrors(validate: ValidateFunction): string {
  return ajv.errorsText(validate.errors, { separator: "; " });
}

function headerRecord(headers: globalThis.Headers): Record<string, string | undefined> {
  const record: Record<string, string | undefined> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function jsonResponse(status: number, body: unknown): WebResponse {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export type WhopGatewayHandlers = {
  wellKnown: (request: WebRequest) => Promise<WebResponse>;
  actions: (request: WebRequest) => Promise<WebResponse>;
  invoke: (request: WebRequest) => Promise<WebResponse>;
};

/** Fetch handlers for Next.js App Router and any host that uses the Web Request API. */
export function createWhopGatewayHandlers(options: CreateWhopGatewayAppOptions): WhopGatewayHandlers {
  const catalog = catalogFor(options);
  const actions = registeredActions(options);
  const validators = new Map<string, ValidateFunction>();
  for (const [name, def] of Object.entries(actions)) {
    validators.set(name, ajv.compile(def.inputSchema));
  }

  return {
    async wellKnown(request) {
      const url = new URL(request.url);
      const hostBase = url.origin;
      const useHost = !options.publicBaseUrl || /:0(?:\/|$)/.test(options.publicBaseUrl);
      return jsonResponse(200, capabilityFor({ ...options, publicBaseUrl: useHost ? hostBase : options.publicBaseUrl }));
    },
    async actions() {
      return jsonResponse(200, catalog);
    },
    async invoke(request) {
      const headers = headerRecord(request.headers);
      if (!isGatewayRequest(headers)) {
        return jsonResponse(401, { ok: false, error: `Missing ${HEADER_GATEWAY}: ${HEADER_GATEWAY_VALUE}` });
      }
      const token = bearerToken(headers);
      if (!token || (options.expectedToken && token !== options.expectedToken)) {
        return jsonResponse(401, { ok: false, error: token ? "Invalid access token" : "Missing Authorization Bearer" });
      }
      const body = (await request.json().catch(() => null)) as unknown;
      const parsed = InvokeRequestSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(400, { ok: false, app_id: options.appId, action: "", error: parsed.error.message });
      }
      const { action, path } = parsed.data;
      const handler = actions[action];
      if (!handler) {
        return jsonResponse(404, { ok: false, app_id: options.appId, action, error: `Unknown action: ${action}` });
      }
      const args = invokeArguments(parsed.data);
      const validate = validators.get(action);
      if (validate && !validate(args)) {
        return jsonResponse(400, {
          ok: false,
          app_id: options.appId,
          action,
          error: `Invalid arguments: ${formatSchemaErrors(validate)}`,
        });
      }
      try {
        const data = await handler.handler(args, { token, path });
        return jsonResponse(200, { ok: true, app_id: options.appId, action, data });
      } catch (err) {
        return jsonResponse(500, {
          ok: false,
          app_id: options.appId,
          action,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

export function mountWhopGateway(app: Express, options: CreateWhopGatewayAppOptions): Capability {
  const capability = capabilityFor(options);
  const catalog = catalogFor(options);
  const actions = registeredActions(options);
  const validators = new Map<string, ValidateFunction>();
  for (const [name, def] of Object.entries(actions)) {
    validators.set(name, ajv.compile(def.inputSchema));
  }

  app.get(WELL_KNOWN_PATH, (req, res) => {
    const hostBase = `${req.protocol}://${req.get("host")}`;
    const useHost = !options.publicBaseUrl || /:0(?:\/|$)/.test(options.publicBaseUrl);
    res.json(capabilityFor({ ...options, publicBaseUrl: useHost ? hostBase : options.publicBaseUrl }));
  });

  app.get(ACTIONS_PATH, (_req, res) => {
    res.json(catalog);
  });

  app.get(MCP_PATH, (_req, res) => {
    res.json({
      transport: "streamable-http",
      note: "HTTP invoke is the v1 contract; Streamable HTTP MCP can be added without changing well-known.",
      capability,
    });
  });

  app.post(INVOKE_PATH, requireGatewayAuth(options.expectedToken), async (req, res) => {
    const parsed = InvokeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        app_id: options.appId,
        action: "",
        error: parsed.error.message,
      });
      return;
    }
    const { action, path } = parsed.data;
    const handler = actions[action];
    if (!handler) {
      res.status(404).json({
        ok: false,
        app_id: options.appId,
        action,
        error: `Unknown action: ${action}`,
      });
      return;
    }
    const args = invokeArguments(parsed.data);
    const validate = validators.get(action);
    if (validate && !validate(args)) {
      res.status(400).json({
        ok: false,
        app_id: options.appId,
        action,
        error: `Invalid arguments: ${formatSchemaErrors(validate)}`,
      });
      return;
    }
    try {
      const token = bearerToken(req.headers)!;
      const data = await handler.handler(args, { token, path });
      res.json({
        ok: true,
        app_id: options.appId,
        action,
        data,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        app_id: options.appId,
        action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return capability;
}

export function createWhopGatewayApp(options: CreateWhopGatewayAppOptions): {
  app: Express;
  capability: Capability;
  catalog: Catalog;
} {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const capability = mountWhopGateway(app, options);
  const catalog = catalogFor(options);
  app.get(HEALTH_PATH, (_req, res) => {
    res.json({ ok: true, app_id: options.appId });
  });
  return { app, capability, catalog };
}
