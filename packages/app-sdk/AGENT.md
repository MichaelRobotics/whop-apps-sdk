# Workstream B — App SDK

You own **only** `packages/app-sdk`. Whop apps add this library so the gateway can probe, list actions, and invoke them. Apps live in their own hosts — this package is a mountable HTTP contract, not a plugin runtime.

## Goal

Mount:

- `GET /.well-known/whop-gateway.json` — protocol Capability
- `GET /gateway/actions` — protocol Catalog from `actions{}`
- `POST /gateway/invoke` — require `X-Whop-Gateway` + Bearer; validate args; run handler

**No Skill files.** Hosts never attach to an app MCP. Maps of “what this app can do” come from the catalog, not SKILL.md.

## Registering actions

```ts
createWhopGatewayApp({
  appId,
  name,
  publicBaseUrl,
  expectedToken, // local/mock only
  actions: {
    ping: {
      title: "Ping",
      description: "When-to-use text for the host",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      destructive: false,
      handler: () => ({ pong: true }),
    },
  },
});
```

If `actions` is omitted, the SDK serves default `ping` + `get` (same shape as the protocol catalog fixture).

## Auth

- Invoke **401** without `X-Whop-Gateway: whop-apps-gateway` or without `Authorization: Bearer`.
- Unknown action → **404**. Arguments that fail that action’s `inputSchema` → **400**.
- `expectedToken`: local mock / e2e. If set, only that bearer is accepted.
- **Production:** treat Bearer as the **user’s Whop access token**. Introspect it in the app (not this SDK in v1). When `expectedToken` is unset, any non-empty bearer is accepted once the gateway header is present.

## Contract you must not break

Import schemas from `@whop-apps-gateway/protocol`. Do not invent a second capability or catalog shape.

## Commands

```bash
npm run build -w @whop-apps-gateway/protocol
npm run test -w @whop-apps-gateway/app-sdk
npm run build -w @whop-apps-gateway/app-sdk
```

## Done when

- Well-known document is protocol-valid.
- `GET /gateway/actions` is a protocol `Catalog`.
- Invoke without gateway header or Bearer → 401.
- Unknown action → 404; bad arguments fail `inputSchema`.
- `ping` with gateway headers → `{ ok: true }`.
- No Skill files in this package.

## Follow-up (optional, same package)

Replace `/mcp` stub with real Streamable HTTP MCP without changing well-known fields.
