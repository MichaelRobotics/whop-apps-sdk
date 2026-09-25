import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACTIONS_PATH,
  GATEWAY_NAME,
  GATEWAY_TOOLS,
  HEADER_GATEWAY_VALUE,
  InvokeRequestSchema,
  WELL_KNOWN_PATH,
  actionsUrl,
  bearerToken,
  gatewayHeaders,
  isGatewayRequest,
  parseCapability,
  parseCatalog,
  safeParseCapability,
  safeParseCatalog,
  wellKnownUrl,
} from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");

describe("protocol contract", () => {
  it("parses the valid capability fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixtures, "capability.valid.json"), "utf8"));
    const cap = parseCapability(raw);
    assert.equal(cap.gateway, GATEWAY_NAME);
    assert.equal(cap.version, "1");
    assert.equal(cap.auth, "whop-oauth");
    assert.match(cap.mcp, /\/mcp$/);
    assert.match(cap.invoke, /\/gateway\/invoke$/);
  });

  it("rejects the invalid capability fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixtures, "capability.invalid.json"), "utf8"));
    const parsed = safeParseCapability(raw);
    assert.equal(parsed.success, false);
  });

  it("builds the well-known probe URL without double slashes", () => {
    assert.equal(
      wellKnownUrl("http://127.0.0.1:8791/"),
      `http://127.0.0.1:8791${WELL_KNOWN_PATH}`,
    );
  });

  it("exposes the gateway tools in order including app_actions", () => {
    assert.deepEqual([...GATEWAY_TOOLS], [
      "connection_status",
      "discover_apps",
      "create_connection",
      "list_connections",
      "disconnect_app",
      "app_get",
      "app_get_data",
      "app_actions",
      "app_invoke",
    ]);
  });

  it("parses the valid catalog fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixtures, "catalog.valid.json"), "utf8"));
    const catalog = parseCatalog(raw);
    assert.equal(catalog.app_id, "app_sample");
    assert.equal(catalog.actions.length, 2);
    assert.equal(catalog.actions[0]?.name, "ping");
    assert.equal(catalog.actions[0]?.destructive, false);
    assert.equal(typeof catalog.actions[0]?.inputSchema, "object");
    assert.equal(catalog.actions[1]?.name, "get");
  });

  it("rejects the invalid catalog fixture", () => {
    const raw = JSON.parse(readFileSync(join(fixtures, "catalog.invalid.json"), "utf8"));
    const parsed = safeParseCatalog(raw);
    assert.equal(parsed.success, false);
  });

  it("builds the catalog GET URL without double slashes", () => {
    assert.equal(ACTIONS_PATH, "/gateway/actions");
    assert.equal(
      actionsUrl("http://127.0.0.1:8791/"),
      "http://127.0.0.1:8791/gateway/actions",
    );
  });

  it("keeps invoke body as action plus arguments", () => {
    const body = InvokeRequestSchema.parse({
      action: "ping",
      arguments: { path: "/health" },
    });
    assert.equal(body.action, "ping");
    assert.deepEqual(body.arguments, { path: "/health" });
  });

  it("round-trips gateway auth headers", () => {
    const headers = gatewayHeaders("tok_123");
    assert.equal(headers["x-whop-gateway"], HEADER_GATEWAY_VALUE);
    assert.equal(bearerToken({ authorization: headers.authorization }), "tok_123");
    assert.equal(isGatewayRequest(headers), true);
    assert.equal(isGatewayRequest({}), false);
  });
});
