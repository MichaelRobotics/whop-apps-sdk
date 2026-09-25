import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIONS_PATH,
  GATEWAY_NAME,
  INVOKE_PATH,
  PROTOCOL_VERSION,
  WELL_KNOWN_PATH,
  parseCatalog,
  safeParseCapability,
  safeParseCatalog,
  type Catalog,
} from "@whop-apps-gateway/protocol";

export const WELL_KNOWN_RELATIVE_PATH = join(".well-known", "whop-gateway.json");
export const CATALOG_RELATIVE_PATH = join("gateway", "actions.json");

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

export type ParsedArgs = InitOptions | ValidateOptions | { help: true } | { error: string };

export type ValidateResult = { ok: true } | { ok: false; errors: string[] };

export type RunResult = { code: number; stdout: string; stderr: string };

const pingAction = {
  name: "ping",
  title: "Ping",
  description: "Check that the app is reachable and the gateway session is authorized.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  destructive: false,
} as const;

const getAction = {
  name: "get",
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
} as const;

/** Protocol-valid catalog example (`ping`, `get`) matching Agent A's Catalog schema. */
export function sampleCatalog(appId: string): Catalog {
  return parseCatalog({
    app_id: appId,
    actions: [pingAction, getAction],
  });
}

export function scaffoldFiles(options: InitOptions): string[] {
  const written: string[] = [];
  const wellKnownDir = join(options.dir, ".well-known");
  const catalogDir = join(options.dir, "gateway");
  mkdirSync(wellKnownDir, { recursive: true });
  mkdirSync(catalogDir, { recursive: true });
  mkdirSync(join(options.dir, "src"), { recursive: true });

  const base = options.publicBaseUrl.replace(/\/+$/, "");
  const capability = {
    gateway: GATEWAY_NAME,
    version: PROTOCOL_VERSION,
    app_id: options.appId,
    name: options.name,
    mcp: `${base}/mcp`,
    invoke: `${base}${INVOKE_PATH}`,
    auth: "whop-oauth",
  };

  const capPath = join(options.dir, WELL_KNOWN_RELATIVE_PATH);
  writeFileSync(capPath, `${JSON.stringify(capability, null, 2)}\n`);
  written.push(capPath);

  const catalog = sampleCatalog(options.appId);
  const catalogPath = join(options.dir, CATALOG_RELATIVE_PATH);
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  written.push(catalogPath);

  const serverPath = join(options.dir, "src", "gateway-app.mjs");
  writeFileSync(
    serverPath,
    `import { createWhopGatewayApp } from "@whop-apps-gateway/app-sdk";

const port = Number(process.env.PORT ?? "3000");
const { app } = createWhopGatewayApp({
  appId: ${JSON.stringify(options.appId)},
  name: ${JSON.stringify(options.name)},
  publicBaseUrl: ${JSON.stringify(options.publicBaseUrl)},
  expectedToken: process.env.WHOP_ACCESS_TOKEN,
  actions: {
    ping: {
      title: ${JSON.stringify(pingAction.title)},
      description: ${JSON.stringify(pingAction.description)},
      inputSchema: ${JSON.stringify(pingAction.inputSchema)},
      destructive: ${JSON.stringify(pingAction.destructive)},
      handler: () => ({ pong: true }),
    },
    get: {
      title: ${JSON.stringify(getAction.title)},
      description: ${JSON.stringify(getAction.description)},
      inputSchema: ${JSON.stringify(getAction.inputSchema)},
      destructive: ${JSON.stringify(getAction.destructive)},
      handler: (args, ctx) => ({ path: args.path ?? ctx.path ?? "/" }),
    },
  },
});

app.listen(port, "127.0.0.1", () => {
  console.log("whop gateway app on :" + port + " well-known ${WELL_KNOWN_PATH} catalog ${ACTIONS_PATH}");
});
`,
  );
  written.push(serverPath);

  const readme = join(options.dir, "GATEWAY.md");
  writeFileSync(
    readme,
    `# Gateway opt-in

This app is discoverable by Whop Apps Gateway after Connect:

1. Serve \`GET ${WELL_KNOWN_PATH}\`.
2. Serve \`GET ${ACTIONS_PATH}\` (action catalog: ping, get).
3. Serve \`POST ${INVOKE_PATH}\` via \`@whop-apps-gateway/app-sdk\`.
4. Require header \`X-Whop-Gateway: ${GATEWAY_NAME}\` and the user Whop Bearer token.

Validate locally with \`whop-apps-gateway validate\` before serving.

Do not publish this as a Claude/Cursor connector. Only the gateway is a store connector.
`,
  );
  written.push(readme);
  return written;
}

function readJsonFile(path: string, errors: string[]): unknown | undefined {
  if (!existsSync(path)) {
    errors.push(`Missing file: ${path}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Invalid JSON in ${path}: ${message}`);
    return undefined;
  }
}

function formatIssues(
  label: string,
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): string[] {
  return issues.map((issue) => {
    const loc = issue.path.length ? issue.path.map(String).join(".") : "(root)";
    return `${label} ${loc}: ${issue.message}`;
  });
}

export function validateDir(dir: string): ValidateResult {
  const errors: string[] = [];
  const capPath = join(dir, WELL_KNOWN_RELATIVE_PATH);
  const catalogPath = join(dir, CATALOG_RELATIVE_PATH);

  const capRaw = readJsonFile(capPath, errors);
  if (capRaw !== undefined) {
    const parsed = safeParseCapability(capRaw);
    if (!parsed.success) {
      errors.push(...formatIssues(capPath, parsed.error.issues));
    }
  }

  const catalogRaw = readJsonFile(catalogPath, errors);
  if (catalogRaw !== undefined) {
    const parsed = safeParseCatalog(catalogRaw);
    if (!parsed.success) {
      errors.push(...formatIssues(catalogPath, parsed.error.issues));
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "help") return { help: true };
  if (cmd === "validate") {
    let dir = ".";
    for (const a of rest) {
      if (!a.startsWith("-")) dir = a;
    }
    return { command: "validate", dir };
  }
  if (cmd !== "init") return { error: `Unknown command: ${cmd}` };

  let dir = ".";
  let appId = "app_sample";
  let name = "Sample Whop App";
  let publicBaseUrl = "http://127.0.0.1:3000";
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--app-id") appId = rest[++i] ?? appId;
    else if (a === "--name") name = rest[++i] ?? name;
    else if (a === "--url") publicBaseUrl = rest[++i] ?? publicBaseUrl;
    else if (!a.startsWith("-")) dir = a;
  }
  return { command: "init", dir, appId, name, publicBaseUrl };
}

export function helpText(): string {
  return `whop-apps-gateway init [dir] --app-id app_xxx --name "My App" --url http://127.0.0.1:3000
whop-apps-gateway validate [dir]`;
}

export function run(argv: string[]): RunResult {
  const parsed = parseArgs(argv);
  if ("help" in parsed) {
    return { code: 0, stdout: `${helpText()}\n`, stderr: "" };
  }
  if ("error" in parsed) {
    return { code: 1, stdout: "", stderr: `${parsed.error}\n${helpText()}\n` };
  }
  if (parsed.command === "validate") {
    const result = validateDir(parsed.dir);
    if (!result.ok) {
      return { code: 1, stdout: "", stderr: `${result.errors.join("\n")}\n` };
    }
    return { code: 0, stdout: "ok\n", stderr: "" };
  }
  const files = scaffoldFiles(parsed);
  return { code: 0, stdout: `${files.join("\n")}\n`, stderr: "" };
}
