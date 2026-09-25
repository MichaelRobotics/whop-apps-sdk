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

The protocol is already compiled into this package. Do not `pnpm add` or `npm install` `@whop-apps-gateway/protocol`. Nothing is published to npm yet, so that name returns 404. `npm` and `yarn` cannot install a subfolder of this repo. `dist` is already committed, so install must not run a build. pnpm 11 rejects git packages that run `prepare`, and it rejects a second git dependency inside this package.

## What agents get wrong

- This app is not an MCP server and not a Claude, Cursor, Codex, or Grok plugin. Do not add a Skill file. The gateway calls this app.
- Do not install `packages/cli` in the app. The CLI runs on each admin's computer.
- Next.js has no Express server. Use `createWhopGatewayHandlers` below. `mountWhopGateway` is only for an existing Express app.
- `appId` must be the Whop app id (`app_…`). The gateway drops the app when the well-known `app_id` does not match.
- `publicBaseUrl` must be the app's own public host, such as `https://your-app.vercel.app`. The well-known `invoke` field is `{publicBaseUrl}/gateway/invoke`, and that is the URL the gateway POSTs to.
- Do not set `publicBaseUrl` to `https://….apps.whop.com`. Whop's proxy removes the `Authorization` header before forwarding, so invoke through that host always returns 401.
- Whop often leaves `hosted_url` null for an app you host yourself. The gateway then probes `origin`. The well-known file must still be reachable on that origin. Invoke still goes to `publicBaseUrl`, not to `origin`.
- The `name` in this document can differ from the name on the Whop app record. Whop's name is what the gateway lists.
- Map the whole app. One action per real capability. Do not stop at `ping` and `get`.
- A company paywall stays in this app. `ctx.token` is that admin's Whop access token. Resolve their company and allow the action only when that company has paid. Each admin has their own CLI session. The gateway does not know which company paid.

These routes must exist at the root of both the Whop `origin` (so discovery can read the manifest) and `publicBaseUrl` (so invoke receives the bearer):

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

Serve these paths with no extra prefix:

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

`appId` is the Whop app id. `publicBaseUrl` is the app's own host, the one that receives `Authorization`. Map the whole app: one action per real capability, not only `ping` and `get`.

Each action needs:

- `title` — short name
- `description` — when an assistant should use it
- `inputSchema` — a JSON Schema object for the arguments
- `destructive` — `true` for creates, updates, deletes, or anything that spends money; `false` for reads
- `handler(args, ctx)` — call the existing app function. `ctx.token` is the Whop access token of the admin who connected. Use it to see which company they belong to. Do not accept a missing token.

Do not set `expectedToken` in production. Do not log or return `ctx.token`.

A company paywall stays in this app. On each invoke, resolve the admin from `ctx.token`, find their Whop company, and run the action only when that company has paid. Each admin still has their own CLI session. Whop may leave `hosted_url` empty. That is expected for an app you host yourself.

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
