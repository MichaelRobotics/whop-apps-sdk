import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIONS_PATH,
  HEADER_GATEWAY_VALUE,
  WELL_KNOWN_PATH,
  gatewayHeaders,
  parseCapability,
  parseCatalog,
} from "@whop-apps-gateway/protocol";
import { catalogFor, capabilityFor, createWhopGatewayApp } from "./index.js";

async function listen(app: ReturnType<typeof createWhopGatewayApp>["app"]): Promise<{
  base: string;
  close: () => Promise<void>;
}> {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no address"));
        return;
      }
      resolve({
        base: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}

const sampleApp = {
  appId: "app_sample",
  name: "Sample Whop App",
  publicBaseUrl: "http://127.0.0.1:8791",
  expectedToken: "tok_ok",
};

describe("app-sdk", () => {
  it("serves a protocol-valid well-known document", async () => {
    const { app } = createWhopGatewayApp(sampleApp);
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}${WELL_KNOWN_PATH}`);
      assert.equal(res.status, 200);
      const cap = parseCapability(await res.json());
      assert.equal(cap.app_id, "app_sample");
      assert.equal(cap.gateway, "whop-apps-gateway");
    } finally {
      await close();
    }
  });

  it("GET /gateway/actions returns a protocol Catalog of registered actions", async () => {
    const { app, catalog } = createWhopGatewayApp({
      ...sampleApp,
      actions: {
        echo: {
          title: "Echo",
          description: "Return the message you pass when you need to round-trip text.",
          inputSchema: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
            additionalProperties: false,
          },
          destructive: false,
          handler: (args) => ({ message: args.message }),
        },
      },
    });
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}${ACTIONS_PATH}`);
      assert.equal(res.status, 200);
      const body = parseCatalog(await res.json());
      assert.equal(body.app_id, "app_sample");
      assert.equal(body.actions.length, 1);
      assert.equal(body.actions[0]?.name, "echo");
      assert.equal(body.actions[0]?.title, "Echo");
      assert.equal(body.actions[0]?.destructive, false);
      assert.deepEqual(body, catalog);
    } finally {
      await close();
    }
  });

  it("default catalog matches ping + get ActionDefs", () => {
    const catalog = catalogFor(sampleApp);
    assert.deepEqual(
      catalog.actions.map((a) => a.name),
      ["ping", "get"],
    );
    parseCatalog(catalog);
  });

  it("rejects invoke without gateway header", async () => {
    const { app } = createWhopGatewayApp(sampleApp);
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer tok_ok" },
        body: JSON.stringify({ action: "ping" }),
      });
      assert.equal(res.status, 401);
    } finally {
      await close();
    }
  });

  it("rejects invoke without Bearer", async () => {
    const { app } = createWhopGatewayApp(sampleApp);
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-whop-gateway": HEADER_GATEWAY_VALUE,
        },
        body: JSON.stringify({ action: "ping" }),
      });
      assert.equal(res.status, 401);
    } finally {
      await close();
    }
  });

  it("invokes ping when gateway headers and token match", async () => {
    const { app } = createWhopGatewayApp(sampleApp);
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("tok_ok"),
        body: JSON.stringify({ action: "ping" }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; data: { pong: boolean } };
      assert.equal(body.ok, true);
      assert.equal(body.data.pong, true);
    } finally {
      await close();
    }
  });

  it("returns 404 for an unknown action", async () => {
    const { app } = createWhopGatewayApp(sampleApp);
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("tok_ok"),
        body: JSON.stringify({ action: "does_not_exist" }),
      });
      assert.equal(res.status, 404);
      const body = (await res.json()) as { ok: boolean; error: string };
      assert.equal(body.ok, false);
      assert.match(body.error, /Unknown action/);
    } finally {
      await close();
    }
  });

  it("validates invoke arguments against that action's inputSchema", async () => {
    const { app } = createWhopGatewayApp({
      ...sampleApp,
      actions: {
        echo: {
          title: "Echo",
          description: "Return the message you pass when you need to round-trip text.",
          inputSchema: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
            additionalProperties: false,
          },
          destructive: false,
          handler: (args) => ({ message: args.message }),
        },
      },
    });
    const { base, close } = await listen(app);
    try {
      const missing = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("tok_ok"),
        body: JSON.stringify({ action: "echo", arguments: {} }),
      });
      assert.equal(missing.status, 400);
      const missingBody = (await missing.json()) as { error: string };
      assert.match(missingBody.error, /Invalid arguments/);

      const extra = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("tok_ok"),
        body: JSON.stringify({ action: "echo", arguments: { message: "hi", nope: true } }),
      });
      assert.equal(extra.status, 400);

      const ok = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("tok_ok"),
        body: JSON.stringify({ action: "echo", arguments: { message: "hi" } }),
      });
      assert.equal(ok.status, 200);
      const okBody = (await ok.json()) as { data: { message: string } };
      assert.equal(okBody.data.message, "hi");
    } finally {
      await close();
    }
  });

  it("accepts any bearer when expectedToken is unset (production introspect is the app's job)", async () => {
    const { app } = createWhopGatewayApp({
      appId: "app_sample",
      name: "Sample",
      publicBaseUrl: "http://127.0.0.1:8791",
    });
    const { base, close } = await listen(app);
    try {
      const res = await fetch(`${base}/gateway/invoke`, {
        method: "POST",
        headers: gatewayHeaders("user_whop_access_token"),
        body: JSON.stringify({ action: "ping" }),
      });
      assert.equal(res.status, 200);
    } finally {
      await close();
    }
  });

  it("capabilityFor matches HEADER contract", () => {
    const cap = capabilityFor({
      appId: "app_x",
      name: "X",
      publicBaseUrl: "http://127.0.0.1:9",
    });
    assert.equal(cap.auth, "whop-oauth");
    assert.equal(HEADER_GATEWAY_VALUE, "whop-apps-gateway");
  });
});
