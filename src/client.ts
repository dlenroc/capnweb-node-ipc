import { once } from "node:events";
import net from "node:net";

import { RpcSession, type RpcCompatible, type RpcStub } from "capnweb";

import { resolveAddress } from "./endpoint.js";
import { IpcTransport } from "./transport.js";

export interface IpcConnection<T extends RpcCompatible<T>> extends AsyncDisposable {
  readonly remote: RpcStub<T>;
  close(): Promise<void>;
}

export async function connect<T extends RpcCompatible<T>>(
  address: string,
): Promise<IpcConnection<T>> {
  const socket = net.createConnection(resolveAddress(address));

  const transport = new IpcTransport(socket);

  const socketClosed = new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
  });

  try {
    await once(socket, "connect");
  } catch (error) {
    socket.destroy();
    await socketClosed;
    throw error;
  }

  const remote = new RpcSession<T>(transport).getRemoteMain();

  let closePromise: Promise<void> | undefined;

  const close = () =>
    (closePromise ??= (async () => {
      try {
        remote[Symbol.dispose]();
      } finally {
        if (!socket.destroyed) {
          socket.destroy();
        }

        await socketClosed;
      }
    })());

  return {
    remote,
    close,
    [Symbol.asyncDispose]: close,
  };
}
