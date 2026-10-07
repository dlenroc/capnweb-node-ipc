# @dlenroc/capnweb-node-ipc

Local IPC transport for [Cap'n Web](https://github.com/cloudflare/capnweb) on Node.js.

## Install

```bash
npm install @dlenroc/capnweb-node-ipc capnweb
```

## Usage

```ts
import { RpcTarget } from "capnweb";
import { connect, serve } from "@dlenroc/capnweb-node-ipc";

class Api extends RpcTarget {
  hello(name: string) {
    return `Hello ${name}`;
  }
}

await using server = await serve(new Api());

await using connection = await connect<Api>(server.address);

console.log(await connection.remote.hello("World"));
```

Explicit cleanup is also available:

```ts
await connection.close();
await server.close();
```

`server.address` is an opaque generated value suitable for passing between local processes, including through environment variables.

## Platforms

| Platform     | Transport            |
| ------------ | -------------------- |
| Linux        | Abstract Unix socket |
| macOS / Unix | Unix-domain socket   |
| Windows      | Named pipe           |

## Requirements

- Node.js 22+
- [Cap'n Web](https://github.com/cloudflare/capnweb)

For RPC features and usage, see the [Cap'n Web documentation](https://github.com/cloudflare/capnweb).
