import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  authorizeUrl,
  installTargets,
  loadSession,
  mcpEndpoint,
  parseBearer,
  runConnect,
  saveSession,
  writeMcpConfig,
} from "./connect.js";

function home(): string {
  return mkdtempSync(join(tmpdir(), "wag-connect-"));
}

describe("cli connect", () => {
  it("parses the opaque session bearer from the Connected page", () => {
    const html = "<p><code>sess_abc123</code></p><p>not a whop token</p>";
    assert.equal(parseBearer(html), "sess_abc123");
    assert.equal(parseBearer("apik_secret"), undefined);
  });

  it("login saves the bearer and prints the authorize URL without opening a browser", async () => {
    const dir = home();
    let opened = 0;
    const result = await runConnect(["login", "--url", "https://whop-apps-gateway.vercel.app/mcp", "--bearer", "paste sess_frompage"], {
      home: dir,
      openBrowser: () => {
        opened += 1;
      },
    });
    assert.equal(result.code, 0);
    assert.equal(opened, 0);
    assert.match(result.stdout, /https:\/\/whop-apps-gateway\.vercel\.app\/oauth\/authorize/);
    const saved = loadSession(dir);
    assert.equal(saved?.bearer, "sess_frompage");
    assert.equal(saved?.gateway, "https://whop-apps-gateway.vercel.app");
    assert.equal(authorizeUrl(saved!.gateway), "https://whop-apps-gateway.vercel.app/oauth/authorize");
    assert.equal(mcpEndpoint(saved!.gateway), "https://whop-apps-gateway.vercel.app/mcp");
  });

  it("login receives the session from the local OAuth redirect", async () => {
    const dir = home();
    const result = await runConnect(["login", "--url", "https://whop-apps-gateway.vercel.app", "--no-open"], {
      home: dir,
      onAuthorize: (url) => {
        const redirect = new URL(url).searchParams.get("cli_redirect");
        assert.ok(redirect);
        void fetch(`${redirect}?session=sess_from_oauth`);
      },
    });
    assert.equal(result.code, 0);
    assert.equal(loadSession(dir)?.bearer, "sess_from_oauth");
    assert.match(result.stdout, /cli_redirect=/);
  });

  it("calls discover, actions, and invoke with the saved bearer", async () => {
    const dir = home();
    saveSession(dir, { gateway: "https://gateway.test", bearer: "sess_user_a" });
    const seen: Array<{ url: string; authorization: string; body: unknown }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      seen.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization") ?? "",
        body: JSON.parse(String(init?.body)),
      });
      const name = String(input).split("/").pop();
      return new Response(JSON.stringify({ tool: name, ok: true }), { status: 200 });
    };
    const discover = await runConnect(["discover", "--query", "sample"], { home: dir, fetchFn });
    const actions = await runConnect(["actions", "--app-id", "app_sample_1"], { home: dir, fetchFn });
    const invoke = await runConnect(
      ["invoke", "--app-id", "app_sample_1", "--action", "ping", "--args", "{}"],
      { home: dir, fetchFn },
    );
    assert.equal(discover.code, 0);
    assert.equal(actions.code, 0);
    assert.equal(invoke.code, 0);
    assert.deepEqual(
      seen.map((call) => call.url),
      [
        "https://gateway.test/tools/discover_apps",
        "https://gateway.test/tools/app_actions",
        "https://gateway.test/tools/app_invoke",
      ],
    );
    assert.ok(seen.every((call) => call.authorization === "Bearer sess_user_a"));
    assert.deepEqual(seen[2]?.body, { app_id: "app_sample_1", action: "ping", arguments: {} });
  });

  it("writes Cursor, Claude Code, and Codex config without dropping other servers", () => {
    const dir = home();
    const session = { gateway: "https://whop-apps-gateway.vercel.app", bearer: "sess_cfg" };
    const targets = installTargets(dir, undefined);
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(
      targets.cursor,
      `${JSON.stringify({ mcpServers: { other: { url: "https://other.example/mcp" } } }, null, 2)}\n`,
    );
    writeMcpConfig(dir, session, ["cursor", "claude", "codex"]);
    const cursor = JSON.parse(readFileSync(targets.cursor, "utf8")) as {
      mcpServers: Record<string, { url: string; headers: { Authorization: string } }>;
    };
    const claude = JSON.parse(readFileSync(targets.claude, "utf8")) as {
      mcpServers: Record<string, { type?: string; url: string }>;
    };
    const codex = readFileSync(targets.codex, "utf8");
    assert.equal(cursor.mcpServers.other?.url, "https://other.example/mcp");
    assert.equal(cursor.mcpServers["whop-apps-gateway"]?.url, "https://whop-apps-gateway.vercel.app/mcp");
    assert.equal(cursor.mcpServers["whop-apps-gateway"]?.headers.Authorization, "Bearer sess_cfg");
    assert.equal(claude.mcpServers["whop-apps-gateway"]?.type, "http");
    assert.match(codex, /\[mcp_servers\.whop-apps-gateway\]/);
    assert.match(codex, /Bearer sess_cfg/);
  });
});
