# Workstream A — Protocol (locked contract)

You own **only** `packages/protocol`. Other workstreams import this package. Do not expand scope into gateway, SDK, CLI, or connectors.

## Goal

Keep the wire contract stable: capability JSON, probe path, action catalog, invoke body, auth headers, gateway tool names.

## Do not change without updating every consumer test

- `WELL_KNOWN_PATH`
- `ACTIONS_PATH` (`GET /gateway/actions`)
- `CapabilitySchema` fields (`gateway`, `version`, `app_id`, `name`, `mcp`, `invoke`, `auth`)
- `ActionDefSchema` / `CatalogSchema` fields
- `HEADER_GATEWAY` / `HEADER_GATEWAY_VALUE`
- `GATEWAY_TOOLS` (includes `app_actions`)
- invoke body `{ action, arguments }`
- fixture `fixtures/capability.valid.json`
- fixture `fixtures/catalog.valid.json`

## Commands

```bash
npm run test -w @whop-apps-gateway/protocol
npm run build -w @whop-apps-gateway/protocol
```

## Done when

- Valid capability fixture parses; invalid fixture fails.
- Valid catalog fixture parses; invalid fixture fails.
- `wellKnownUrl`, `actionsUrl`, and `gatewayHeaders` tests pass.
- `app_actions` is in `GATEWAY_TOOLS`.
- `parseCatalog` / `safeParseCatalog` (and ActionDef helpers) are exported.

## Out of scope

OAuth with real Whop, Cursor plugins, app business logic, SDK, e2e.
