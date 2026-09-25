import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseCapability, parseCatalog, safeParseCatalog } from "@whop-apps-gateway/protocol";
import {
  CATALOG_RELATIVE_PATH,
  parseArgs,
  run,
  sampleCatalog,
  scaffoldFiles,
  validateDir,
  WELL_KNOWN_RELATIVE_PATH,
} from "./scaffold.js";

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "wag-cli-"));
}

describe("cli scaffold", () => {
  it("writes a protocol-valid well-known file", () => {
    const dir = tmpDir();
    const files = scaffoldFiles({
      command: "init",
      dir,
      appId: "app_sample",
      name: "Sample Whop App",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    const capPath = files.find((f) => f.endsWith("whop-gateway.json"));
    assert.ok(capPath);
    const cap = parseCapability(JSON.parse(readFileSync(capPath, "utf8")));
    assert.equal(cap.app_id, "app_sample");
  });

  it("writes a protocol-valid ping/get action catalog", () => {
    const dir = tmpDir();
    const files = scaffoldFiles({
      command: "init",
      dir,
      appId: "app_cli",
      name: "CLI App",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    const catalogPath = files.find((f) => f.endsWith(join("gateway", "actions.json")) || f.endsWith("actions.json"));
    assert.ok(catalogPath);
    const catalog = parseCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
    assert.equal(catalog.app_id, "app_cli");
    assert.equal(catalog.actions.length, 2);
    assert.equal(catalog.actions[0]?.name, "ping");
    assert.equal(catalog.actions[0]?.destructive, false);
    assert.equal(typeof catalog.actions[0]?.inputSchema, "object");
    assert.equal(catalog.actions[1]?.name, "get");
    assert.equal(catalog.actions[1]?.title, "Get");
  });

  it("sampleCatalog matches Agent A's Catalog schema", () => {
    const catalog = sampleCatalog("app_sample");
    assert.equal(catalog.actions.map((a) => a.name).join(","), "ping,get");
  });

  it("parses init args", () => {
    const parsed = parseArgs(["init", "tmp", "--app-id", "app_x", "--url", "http://127.0.0.1:9"]);
    assert.ok("command" in parsed && parsed.command === "init");
    if ("command" in parsed && parsed.command === "init") {
      assert.equal(parsed.dir, "tmp");
      assert.equal(parsed.appId, "app_x");
    }
  });

  it("parses validate args", () => {
    const parsed = parseArgs(["validate", "out"]);
    assert.ok("command" in parsed);
    if ("command" in parsed) {
      assert.equal(parsed.command, "validate");
      assert.equal(parsed.dir, "out");
    }
  });
});

describe("cli validate", () => {
  it("accepts init output via safeParse", () => {
    const dir = tmpDir();
    scaffoldFiles({
      command: "init",
      dir,
      appId: "app_sample",
      name: "Sample Whop App",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    const result = validateDir(dir);
    assert.equal(result.ok, true);
    const ran = run(["validate", dir]);
    assert.equal(ran.code, 0);
    assert.match(ran.stdout, /^ok\n$/);
  });

  it("exits 1 when catalog fails protocol safeParse", () => {
    const dir = tmpDir();
    scaffoldFiles({
      command: "init",
      dir,
      appId: "app_sample",
      name: "Sample Whop App",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    writeFileSync(
      join(dir, CATALOG_RELATIVE_PATH),
      `${JSON.stringify({
        app_id: "app_sample",
        actions: [
          {
            name: "ping",
            title: "Ping",
            inputSchema: "not-a-json-schema",
            destructive: "no",
          },
        ],
      })}\n`,
    );
    const parsed = safeParseCatalog(JSON.parse(readFileSync(join(dir, CATALOG_RELATIVE_PATH), "utf8")));
    assert.equal(parsed.success, false);
    const ran = run(["validate", dir]);
    assert.equal(ran.code, 1);
    assert.match(ran.stderr, /actions/);
  });

  it("exits 1 when well-known fails protocol safeParse", () => {
    const dir = tmpDir();
    scaffoldFiles({
      command: "init",
      dir,
      appId: "app_sample",
      name: "Sample Whop App",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    writeFileSync(join(dir, WELL_KNOWN_RELATIVE_PATH), `${JSON.stringify({ app_id: "app_sample" })}\n`);
    const ran = run(["validate", dir]);
    assert.equal(ran.code, 1);
    assert.match(ran.stderr, /whop-gateway\.json/);
  });

  it("exits 1 when generated JSON is missing", () => {
    const dir = tmpDir();
    mkdirSync(dir, { recursive: true });
    const ran = run(["validate", dir]);
    assert.equal(ran.code, 1);
    assert.match(ran.stderr, /Missing file/);
  });
});
