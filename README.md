# Whop Apps SDK

Libraries a Whop app installs so the [Whop Apps Gateway](https://whop-apps-gateway.vercel.app) can probe it and call its actions. The gateway service stays in a separate private repo. This repo does not contain it.

Two separate packages. Install only the one you need.

| Package | Who installs it |
|---------|-----------------|
| `@whop-apps-gateway/app-sdk` | The Whop app |
| `@whop-apps-gateway/cli` | Each admin, on their own computer |
| `@whop-apps-gateway/protocol` | Pulled in by the SDK. Not an app. |

Source: https://github.com/MichaelRobotics/whop-apps-sdk

`npm` cannot install a subfolder of this repo. Use pnpm until the packages are published to npm.

## App SDK

Install this in a Whop app. It is `packages/app-sdk`.

Do not install the CLI here. Do not add a Claude, Cursor, Codex, or Grok plugin. Do not add a Skill file. This app is not an MCP server. The gateway calls this app.

```bash
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/app-sdk
```

That install also fetches `@whop-apps-gateway/protocol` from this same repo and compiles it. Do not install protocol from npm.

The compiled `dist` is already in this repo, so install does not need a build step. These paths must be on the public origin Whop lists as `hosted_url`, at the root, with no extra prefix:

Express apps call `mountWhopGateway(app, options)` or `createWhopGatewayApp`. Next.js apps use `createWhopGatewayHandlers` and export the handlers from App Router routes. There is no Express server to mount:

```ts
// lib/whop-gateway.ts
import { createWhopGatewayHandlers } from "@whop-apps-gateway/app-sdk";

export const whopGateway = createWhopGatewayHandlers({
  appId: "app_xxx",
  name: "The app name",
  publicBaseUrl: "https://the-public-url-whop-lists",
  actions: {
    // one entry per thing this app can do
  },
});
```

```ts
// app/.well-known/whop-gateway.json/route.ts
import { whopGateway } from "@/lib/whop-gateway";
export const GET = whopGateway.wellKnown;

// app/gateway/actions/route.ts
import { whopGateway } from "@/lib/whop-gateway";
export const GET = whopGateway.actions;

// app/gateway/invoke/route.ts
import { whopGateway } from "@/lib/whop-gateway";
export const POST = whopGateway.invoke;
```

These paths must be on the public origin Whop lists as `hosted_url`, at the root, with no extra prefix:

- `GET /.well-known/whop-gateway.json`
- `GET /gateway/actions`
- `POST /gateway/invoke`

```ts
import { createWhopGatewayApp } from "@whop-apps-gateway/app-sdk";

const { app } = createWhopGatewayApp({
  appId: "app_xxx",
  name: "The app name",
  publicBaseUrl: "https://the-public-url-whop-lists",
  actions: {
    // one entry per thing this app can do
  },
});
```

`appId` is the Whop app id. `publicBaseUrl` is the public origin Whop will list. Map the whole app: one action per real capability, not only `ping` and `get`.

Each action needs:

- `title` — short name
- `description` — when an assistant should use it
- `inputSchema` — a JSON Schema object for the arguments
- `destructive` — `true` for creates, updates, deletes, or anything that spends money; `false` for reads
- `handler(args, ctx)` — call the existing app function. `ctx.token` is the Whop access token of the admin who connected. Use it to see which company they belong to. Do not accept a missing token.

Do not set `expectedToken` in production. Do not log or return `ctx.token`.

A company paywall stays in this app. On each invoke, resolve the admin from `ctx.token`, find their Whop company, and run the action only when that company has paid. Each admin still has their own CLI session.

Deploy so Whop’s app record shows this deployment as `hosted_url`.

## CLI and MCP

This is `packages/cli`. It runs on an admin’s computer. It is not part of the Whop app.

Each admin runs this separately. Two admins of one company get two sessions.

```bash
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/cli
```

The command name is `whop-apps-gateway`. `npm exec` and `pnpm exec` run that same command.

```bash
pnpm exec whop-apps-gateway login
pnpm exec whop-apps-gateway discover
pnpm exec whop-apps-gateway actions --app-id app_xxx
pnpm exec whop-apps-gateway invoke --app-id app_xxx --action ping
```

`login` opens `https://whop-apps-gateway.vercel.app/oauth/authorize` and saves the opaque `sess_…` bearer when the browser returns to this machine. The same commands work on Linux, macOS, and Windows.

```bash
pnpm exec whop-apps-gateway install
```

That writes the saved bearer into the MCP config for Cursor (`~/.cursor/mcp.json`), Claude Code (`~/.claude.json`), and Codex (`~/.codex/config.toml`). On Windows those files are under `C:\Users\<you>\`.

`--local` writes them into the current project. `--client cursor` writes only one client. The MCP URL is `https://whop-apps-gateway.vercel.app/mcp`.

## Develop

```bash
npm install
npm test
```

Publish order, after `npm login`, from this repo:

```bash
npm publish -w @whop-apps-gateway/protocol --access public
npm publish -w @whop-apps-gateway/app-sdk --access public
npm publish -w @whop-apps-gateway/cli --access public
```
