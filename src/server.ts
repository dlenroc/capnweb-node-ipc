import { once } from "node:events";
import net from "node:net";

import { RpcSession, RpcStub, type RpcTarget } from "capnweb";

import { cleanupEndpoint, createEndpoint, resolveAddress } from "./endpoint.js";

import { IpcTransport } from "./transport.js";

export interface IpcServer extends AsyncDisposable {
  readonly address: string;
  close(): Promise<void>;
}

export async function serve(target: RpcTarget): Promise<IpcServer> {
  const address = createEndpoint();
  const root = new RpcStub(target);

  const sockets = new Set<net.Socket>();

  const sessionEnds = new Set<Promise<void>>();

  let closing = false;

  const server = net.createServer((socket) => {
    if (closing) {
      socket.destroy();
      return;
    }

    sockets.add(socket);

    socket.once("close", () => {
      sockets.delete(socket);
    });

    const transport = new IpcTransport(socket);

    new RpcSession(transport, root.dup());

    const ended = transport.ended;

    sessionEnds.add(ended);

    ended.then(() => {
      sessionEnds.delete(ended);
    });
  });

  try {
    server.listen(resolveAddress(address));

    await once(server, "listening");
  } catch (error) {
    cleanupEndpoint(address);
    root[Symbol.dispose]();
    throw error;
  }

  let closePromise: Promise<void> | undefined;

  const close = () =>
    (closePromise ??= (async () => {
      closing = true;

      const serverClosed = server[Symbol.asyncDispose]();

      for (const socket of sockets) {
        socket.destroy();
      }

      try {
        await serverClosed;
        await Promise.all(sessionEnds);
      } finally {
        cleanupEndpoint(address);
        root[Symbol.dispose]();
      }
    })());

  return {
    address,
    close,
    [Symbol.asyncDispose]: close,
  };
}
