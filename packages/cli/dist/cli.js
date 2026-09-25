#!/usr/bin/env node
import { isConnectCommand, runConnect } from "./connect.js";
import { run } from "./scaffold.js";
const argv = process.argv.slice(2);
const result = isConnectCommand(argv)
    ? await runConnect(argv, {
        onAuthorize: (url) => process.stderr.write(`Waiting for Whop approval. Open this URL if no browser opened:\n${url}\n\n`),
    })
    : run(argv);
if (result.stdout)
    process.stdout.write(result.stdout);
if (result.stderr)
    process.stderr.write(result.stderr);
process.exit(result.code);
//# sourceMappingURL=cli.js.map