# CLI and MCP

This is `packages/cli` in [whop-apps-sdk](https://github.com/MichaelRobotics/whop-apps-sdk). It runs on an admin’s computer. It is not part of the Whop app.

The app installs only the SDK. See [docs/sdk.md](sdk.md).

Each admin runs this separately. Two admins of one company get two sessions.

## Install

```bash
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/cli
```

The command name is `whop-apps-gateway`. `npm exec` and `pnpm exec` run that same command. `npm` cannot install this subfolder from git; use pnpm until the package is on the npm registry.

## Login and call the gateway

```bash
pnpm exec whop-apps-gateway login
pnpm exec whop-apps-gateway discover
pnpm exec whop-apps-gateway actions --app-id app_xxx
pnpm exec whop-apps-gateway invoke --app-id app_xxx --action ping
```

`login` opens `https://whop-apps-gateway.vercel.app/oauth/authorize` and saves the opaque `sess_…` bearer when the browser returns to this machine. The same commands work on Linux, macOS, and Windows.

## MCP config

```bash
pnpm exec whop-apps-gateway install
```

That writes the saved bearer into the MCP config for Cursor (`~/.cursor/mcp.json`), Claude Code (`~/.claude.json`), and Codex (`~/.codex/config.toml`). On Windows those files are under `C:\Users\<you>\`.

`--local` writes them into the current project. `--client cursor` writes only one client. The MCP URL is `https://whop-apps-gateway.vercel.app/mcp`.
