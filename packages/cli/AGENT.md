# Workstream D — CLI

You own **only** `packages/cli`. Scaffolds a Whop app so workstream B's SDK can be mounted. Not a runtime.

App authors run this on their laptop (`init` / `validate`). Admins can use it to test the gateway. Hosts such as Cursor, Grok, and Claude do **not** use it at runtime.

## Goal

Author scaffold:

```
whop-apps-gateway init [dir] --app-id app_xxx --name "..." --url http://127.0.0.1:3000
whop-apps-gateway validate [dir]
```

Laptop test client (same binary, any OS with Node 20):

```
whop-apps-gateway login [--url https://whop-apps-gateway.vercel.app] [--bearer sess_…] [--no-open]
whop-apps-gateway status
whop-apps-gateway discover [--query text]
whop-apps-gateway connect --app-id app_xxx
whop-apps-gateway actions --app-id app_xxx
whop-apps-gateway invoke --app-id app_xxx --action ping [--args '{}']
whop-apps-gateway install [--client cursor|claude|codex|all] [--local]
```

`login` opens `/oauth/authorize` with a localhost redirect and prints that URL on stderr while it waits. After Whop approval the gateway sends only the opaque `sess_` bearer back to that local URL, and the CLI stores it in `~/.whop-apps-gateway/session.json`. `connect` calls `create_connection`; run it once per app before `actions` or `invoke`.

`install` writes that bearer into Cursor (`~/.cursor/mcp.json`), Claude Code (`~/.claude.json`), and Codex (`~/.codex/config.toml`). `--local` writes the project files instead. Hosts can also sign in with the URL alone through the gateway's MCP OAuth. A bearer written by `install` skips that sign-in, so remove it from the host config to let the host log in on its own.

`init` writes:

- `.well-known/whop-gateway.json` that **parses with protocol** `CapabilitySchema`
- `gateway/actions.json` catalog example (`ping`, `get`) that **parses with protocol** `CatalogSchema`
- sample `src/gateway-app.mjs` registering those actions for the SDK

`validate` reads the generated well-known + catalog JSON and `safeParse`s with protocol. Exit **1** on missing files, invalid JSON, or schema failure.

## Commands

```bash
npm run build -w @whop-apps-gateway/protocol
npm run test -w @whop-apps-gateway/cli
```

## Done when

Generated capability + catalog JSON are protocol-valid. `validate` fails closed. Do not add a second capability or catalog schema.
