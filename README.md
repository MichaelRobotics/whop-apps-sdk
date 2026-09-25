# Whop Apps SDK

Libraries a Whop app installs so the [Whop Apps Gateway](https://whop-apps-gateway.vercel.app) can probe it and call its actions. The gateway service stays in a separate private repo. This repo does not contain it.

| Package | Install |
|---------|---------|
| `@whop-apps-gateway/app-sdk` | Mount `/.well-known/whop-gateway.json`, `GET /gateway/actions`, and `POST /gateway/invoke` |
| `@whop-apps-gateway/cli` | `init` a sample app, `login` to the gateway, write MCP config |
| `@whop-apps-gateway/protocol` | Shared catalog and capability schema. Installed with the SDK. |

```bash
npm install @whop-apps-gateway/app-sdk
npx @whop-apps-gateway/cli init
npx @whop-apps-gateway/cli login
```

`pnpm add` and `npm exec` use the same package names. Until these packages are on the npm registry, install the `v0.1.0` release tarballs from this repo.

```ts
import { createWhopGatewayApp } from "@whop-apps-gateway/app-sdk";

const { app } = createWhopGatewayApp({
  appId: "app_xxx",
  name: "My App",
  publicBaseUrl: "https://the-public-url-whop-lists",
  actions: {
    ping: {
      title: "Ping",
      description: "Check that this app is reachable through the gateway.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      destructive: false,
      handler: () => ({ pong: true }),
    },
  },
});

app.listen(process.env.PORT ?? 3000);
```

Whop’s app record still has to expose that deployment as `hosted_url`. This SDK does not register the app.

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
