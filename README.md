# Whop Apps SDK

Libraries a Whop app installs so the [Whop Apps Gateway](https://whop-apps-gateway.vercel.app) can probe it and call its actions. The gateway service stays in a separate private repo. This repo does not contain it.

Two separate packages. Install only the one you need.

| Package | Who installs it | Guide |
|---------|-----------------|-------|
| `@whop-apps-gateway/app-sdk` | The Whop app | [docs/sdk.md](docs/sdk.md) |
| `@whop-apps-gateway/cli` | Each admin, on their own computer | [docs/cli.md](docs/cli.md) |
| `@whop-apps-gateway/protocol` | Pulled in by the SDK. Not an app. | |

Source for all three is this repo: https://github.com/MichaelRobotics/whop-apps-sdk

```bash
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/app-sdk
pnpm add github:MichaelRobotics/whop-apps-sdk#path:packages/cli
```

The first command belongs in the Whop app. The second belongs on the admin’s machine. `npm` cannot install a subfolder of this repo; use pnpm until the packages are published to npm.

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
