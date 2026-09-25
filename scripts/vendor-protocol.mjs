import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const protocolDir = new URL("packages/protocol/dist/", root);
const target = process.argv[2];
if (!target) throw new Error("usage: node scripts/vendor-protocol.mjs packages/app-sdk");
const dist = new URL(`${target}/dist/`, root);
copyFileSync(new URL("index.js", protocolDir), new URL("protocol.js", dist));
copyFileSync(new URL("index.d.ts", protocolDir), new URL("protocol.d.ts", dist));
for (const name of readdirSync(dist)) {
  if (!name.endsWith(".js") && !name.endsWith(".d.ts")) continue;
  if (name.startsWith("protocol.")) continue;
  const file = new URL(name, dist);
  const source = readFileSync(file, "utf8");
  writeFileSync(file, source.replaceAll("@whop-apps-gateway/protocol", "./protocol.js"));
}
console.log(`vendored protocol into ${target}`);
