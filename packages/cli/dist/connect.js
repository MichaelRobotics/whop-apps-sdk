import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { TOOLS_HTTP_PATH } from "@whop-apps-gateway/protocol";
export const DEFAULT_GATEWAY = "https://whop-apps-gateway.vercel.app";
export const SERVER_NAME = "whop-apps-gateway";
const CONNECT_COMMANDS = new Set(["login", "status", "discover", "actions", "invoke", "install"]);
const BEARER_RE = /sess_[A-Za-z0-9_-]+/;
const CODEX_BEGIN = "# whop-apps-gateway begin";
const CODEX_END = "# whop-apps-gateway end";
export function isConnectCommand(argv) {
    const cmd = argv[0];
    return !cmd || cmd === "help" || cmd === "--help" || cmd === "-h" || CONNECT_COMMANDS.has(cmd);
}
export function gatewayBase(raw) {
    return raw.replace(/\/+$/, "").replace(/\/mcp$/, "");
}
export function authorizeUrl(gateway, cliRedirect) {
    const base = `${gatewayBase(gateway)}/oauth/authorize`;
    if (!cliRedirect)
        return base;
    return `${base}?cli_redirect=${encodeURIComponent(cliRedirect)}`;
}
export function listenForSession(timeoutMs = 5 * 60 * 1000) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            if (url.pathname !== "/callback") {
                res.writeHead(404).end();
                return;
            }
            const session = url.searchParams.get("session") ?? "";
            const bearer = /^sess_[A-Za-z0-9_-]+$/.test(session) ? session : undefined;
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(bearer
                ? "<!doctype html><title>Connected</title><p>Whop Apps Gateway is connected. You can close this window.</p>"
                : "<!doctype html><title>Connect failed</title><p>The login redirect did not include a session.</p>");
            if (bearer)
                finish(bearer);
            else
                finish(undefined);
        });
        let finish = (_bearer) => { };
        const session = new Promise((resolveSession, rejectSession) => {
            const timer = setTimeout(() => {
                server.close();
                rejectSession(new Error("Timed out waiting for Whop login."));
            }, timeoutMs);
            finish = (bearer) => {
                clearTimeout(timer);
                server.close();
                if (bearer)
                    resolveSession(bearer);
                else
                    rejectSession(new Error("Login redirect did not include a session."));
            };
        });
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("Could not listen for the OAuth redirect."));
                return;
            }
            resolve({
                redirectUrl: `http://127.0.0.1:${address.port}/callback`,
                session,
                close: () => server.close(),
            });
        });
        server.on("error", reject);
    });
}
export function mcpEndpoint(gateway) {
    return `${gatewayBase(gateway)}/mcp`;
}
export function parseBearer(input) {
    return input.match(BEARER_RE)?.[0];
}
export function sessionPath(home) {
    return join(home, ".whop-apps-gateway", "session.json");
}
export function loadSession(home) {
    const path = sessionPath(home);
    if (!existsSync(path))
        return undefined;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed.gateway || !parsed.bearer || !parseBearer(parsed.bearer))
        return undefined;
    return { gateway: gatewayBase(parsed.gateway), bearer: parseBearer(parsed.bearer) };
}
export function saveSession(home, session) {
    const path = sessionPath(home);
    mkdirSync(dirname(path), { recursive: true });
    const bearer = parseBearer(session.bearer);
    if (!bearer)
        throw new Error("Session bearer must look like sess_…");
    writeFileSync(path, `${JSON.stringify({ gateway: gatewayBase(session.gateway), bearer }, null, 2)}\n`, {
        mode: 0o600,
    });
    return path;
}
export function openBrowser(url) {
    const child = process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true })
        : process.platform === "darwin"
            ? spawn("open", [url], { detached: true, stdio: "ignore" })
            : spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
}
function flags(argv) {
    const positionals = [];
    const values = new Map();
    const present = new Set();
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--")
            continue;
        if (arg.startsWith("--")) {
            const name = arg.slice(2);
            present.add(name);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                values.set(name, next);
                i++;
            }
            continue;
        }
        positionals.push(arg);
    }
    return {
        positionals,
        get: (name) => values.get(name),
        has: (name) => present.has(name),
    };
}
export function helpText() {
    return `whop-apps-gateway login [--url ${DEFAULT_GATEWAY}] [--bearer sess_…] [--no-open]
whop-apps-gateway status
whop-apps-gateway discover [--query text]
whop-apps-gateway actions --app-id app_xxx
whop-apps-gateway invoke --app-id app_xxx --action ping [--args '{}']
whop-apps-gateway install [--client cursor|claude|codex|all] [--local]
whop-apps-gateway init [dir] --app-id app_xxx --name "My App" --url http://127.0.0.1:3000
whop-apps-gateway validate [dir]

login opens ${DEFAULT_GATEWAY}/oauth/authorize and saves the sess_ bearer when the browser returns to this machine.
install writes that bearer into the MCP config for Cursor, Claude Code, and Codex.`;
}
export async function callTool(session, name, args, fetchFn) {
    const res = await fetchFn(`${gatewayBase(session.gateway)}${TOOLS_HTTP_PATH}/${name}`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${session.bearer}`,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify(args),
    });
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    return { status: res.status, body };
}
function serverEntry(session, withType) {
    const entry = {
        url: mcpEndpoint(session.gateway),
        headers: { Authorization: `Bearer ${session.bearer}` },
    };
    if (withType)
        entry.type = "http";
    return entry;
}
function readJsonObject(path) {
    if (!existsSync(path))
        return {};
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${path} is not a JSON object`);
    }
    return parsed;
}
function mergeMcpJson(path, session, withType) {
    const doc = readJsonObject(path);
    const servers = doc.mcpServers && typeof doc.mcpServers === "object" && !Array.isArray(doc.mcpServers)
        ? doc.mcpServers
        : {};
    servers[SERVER_NAME] = serverEntry(session, withType);
    doc.mcpServers = servers;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
}
function codexBlock(session) {
    const url = mcpEndpoint(session.gateway);
    const header = `Bearer ${session.bearer}`;
    return `${CODEX_BEGIN}
[mcp_servers.${SERVER_NAME}]
url = ${JSON.stringify(url)}

[mcp_servers.${SERVER_NAME}.http_headers]
Authorization = ${JSON.stringify(header)}
${CODEX_END}
`;
}
function mergeCodex(path, session) {
    const block = codexBlock(session);
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    const pattern = new RegExp(`${CODEX_BEGIN}[\\s\\S]*?${CODEX_END}\\n?`, "m");
    const next = pattern.test(current) ? current.replace(pattern, block) : `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${block}`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next.endsWith("\n") ? next : `${next}\n`);
}
export function installTargets(home, localDir) {
    if (localDir) {
        return {
            cursor: join(localDir, ".cursor", "mcp.json"),
            claude: join(localDir, ".mcp.json"),
            codex: join(localDir, ".codex", "config.toml"),
        };
    }
    return {
        cursor: join(home, ".cursor", "mcp.json"),
        claude: join(home, ".claude.json"),
        codex: join(home, ".codex", "config.toml"),
    };
}
export function writeMcpConfig(home, session, clients, localDir) {
    const targets = installTargets(home, localDir);
    const written = [];
    for (const client of clients) {
        if (client === "codex")
            mergeCodex(targets.codex, session);
        else
            mergeMcpJson(targets[client], session, client === "claude");
        written.push(targets[client]);
    }
    return written;
}
function fail(message) {
    return { code: 1, stdout: "", stderr: `${message}\n` };
}
function jsonResult(status, body) {
    const text = `${JSON.stringify(body, null, 2)}\n`;
    if (status >= 400)
        return { code: 1, stdout: "", stderr: text };
    return { code: 0, stdout: text, stderr: "" };
}
function requireSession(home, urlOverride) {
    const saved = loadSession(home);
    if (!saved && !urlOverride) {
        return fail("No saved session. Run: whop-apps-gateway login");
    }
    if (!saved)
        return fail("No saved session bearer. Run: whop-apps-gateway login --bearer sess_…");
    return urlOverride ? { ...saved, gateway: gatewayBase(urlOverride) } : saved;
}
function parseClients(raw) {
    const value = raw ?? "all";
    if (value === "all")
        return ["cursor", "claude", "codex"];
    const parts = value.split(",").map((part) => part.trim());
    const allowed = new Set(["cursor", "claude", "codex"]);
    if (parts.length === 0 || parts.some((part) => !allowed.has(part))) {
        return "Client must be cursor, claude, codex, or all.";
    }
    return parts;
}
export async function runConnect(argv, io = {}) {
    const home = io.home ?? homedir();
    const fetchFn = io.fetchFn ?? fetch;
    const open = io.openBrowser ?? openBrowser;
    const [cmd, ...rest] = argv;
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
        return { code: 0, stdout: `${helpText()}\n`, stderr: "" };
    }
    const parsed = flags(rest);
    if (cmd === "login") {
        const gateway = gatewayBase(parsed.get("url") ?? DEFAULT_GATEWAY);
        const given = parsed.get("bearer");
        let bearer = given ? parseBearer(given) : undefined;
        if (given && !bearer)
            return fail("Bearer must look like sess_…");
        let url = authorizeUrl(gateway);
        if (!bearer) {
            const listener = await (io.listenForSession ?? listenForSession)();
            url = authorizeUrl(gateway, listener.redirectUrl);
            io.onAuthorize?.(url);
            if (!parsed.has("no-open"))
                open(url);
            try {
                bearer = await listener.session;
            }
            catch (err) {
                listener.close();
                const message = err instanceof Error ? err.message : "Login failed.";
                return fail(message);
            }
        }
        const path = saveSession(home, { gateway, bearer });
        return {
            code: 0,
            stdout: `Open this URL and approve Whop:\n${url}\n\nSaved session to ${path}\n`,
            stderr: "",
        };
    }
    const sessionOrError = requireSession(home, parsed.get("url"));
    if ("code" in sessionOrError)
        return sessionOrError;
    const session = sessionOrError;
    if (cmd === "status") {
        const result = await callTool(session, "connection_status", {}, fetchFn);
        return jsonResult(result.status, result.body);
    }
    if (cmd === "discover") {
        const args = {};
        const query = parsed.get("query");
        if (query)
            args.query = query;
        const result = await callTool(session, "discover_apps", args, fetchFn);
        return jsonResult(result.status, result.body);
    }
    if (cmd === "actions") {
        const appId = parsed.get("app-id");
        if (!appId)
            return fail("actions requires --app-id app_xxx");
        const result = await callTool(session, "app_actions", { app_id: appId }, fetchFn);
        return jsonResult(result.status, result.body);
    }
    if (cmd === "invoke") {
        const appId = parsed.get("app-id");
        const action = parsed.get("action");
        if (!appId || !action)
            return fail("invoke requires --app-id app_xxx --action name");
        let args = {};
        const rawArgs = parsed.get("args");
        if (rawArgs) {
            try {
                const parsedArgs = JSON.parse(rawArgs);
                if (!parsedArgs || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
                    return fail("--args must be a JSON object");
                }
                args = parsedArgs;
            }
            catch {
                return fail("--args must be a JSON object");
            }
        }
        const result = await callTool(session, "app_invoke", { app_id: appId, action, arguments: args }, fetchFn);
        return jsonResult(result.status, result.body);
    }
    if (cmd === "install") {
        const clients = parseClients(parsed.get("client"));
        if (typeof clients === "string")
            return fail(clients);
        const written = writeMcpConfig(home, session, clients, parsed.has("local") ? process.cwd() : undefined);
        return { code: 0, stdout: `${written.join("\n")}\n`, stderr: "" };
    }
    return fail(`Unknown command: ${cmd}\n${helpText()}`);
}
//# sourceMappingURL=connect.js.map