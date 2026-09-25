# App SDK

Install this in a Whop app. It is `packages/app-sdk` in [whop-apps-sdk](https://github.com/MichaelRobotics/whop-apps-sdk).

Do not install the CLI here. Do not add a Claude, Cursor, Codex, or Grok plugin. Do not add a Skill file. This app is not an MCP server. The gateway calls this app.

The CLI and the MCP config live in a separate package: [docs/cli.md](cli.md).

## Install

From this public repo:

```bash
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/protocol
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/app-sdk
```

`npm` and `yarn` do not install a subfolder of a git repo. Use pnpm for the git install, or publish the packages to npm and then:

```bash
npm install @whop-apps-gateway/app-sdk
```

## Mount

If the app already has an HTTP server, call `mountWhopGateway(app, options)` on that server. Otherwise use `createWhopGatewayApp` and listen. These paths must be on the public origin Whop lists as `hosted_url`, at the root, with no extra prefix:

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
