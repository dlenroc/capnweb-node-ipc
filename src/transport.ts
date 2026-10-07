import type { Socket } from "node:net";

import type { RpcTransportWithCustomEncoding } from "capnweb";
import { Packr, UnpackrStream } from "msgpackr";

export class IpcTransport implements RpcTransportWithCustomEncoding {
  readonly encodingLevel = "jsonCompatibleWithBytes";

  readonly #packr = new Packr({
    sequential: true,
  });

  readonly #unpackr = new UnpackrStream();

  readonly #queue: unknown[] = [];

  readonly #ended = Promise.withResolvers<void>();

  readonly ended: Promise<void> = this.#ended.promise;

  #waiting?: PromiseWithResolvers<unknown>;
  #error?: Error;

  constructor(private readonly socket: Socket) {
    socket.pipe(this.#unpackr);

    this.#unpackr.on("data", (value) => {
      if (this.#waiting) {
        const { resolve } = this.#waiting;

        this.#waiting = undefined;

        resolve(value);
      } else {
        this.#queue.push(value);
      }
    });

    this.#unpackr.once("error", (error) => {
      this.#fail(error);
      socket.destroy(error);
    });

    socket.once("error", (error) => {
      this.#fail(error);
    });

    socket.once("close", () => {
      this.#fail(new Error("IPC connection closed"));
    });
  }

  send(value: unknown): number {
    if (this.#error) {
      throw this.#error;
    }

    const encoded = this.#packr.pack(value);

    this.socket.write(encoded);

    return encoded.byteLength;
  }

  receive(): Promise<unknown> {
    if (this.#queue.length > 0) {
      return Promise.resolve(this.#queue.shift());
    }

    if (this.#error) {
      return Promise.reject(this.#error);
    }

    this.#waiting = Promise.withResolvers<unknown>();

    return this.#waiting.promise;
  }

  abort(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    this.#fail(error);

    try {
      this.socket.destroy(error);
    } finally {
      queueMicrotask(this.#ended.resolve);
    }
  }

  #fail(error: Error) {
    if (this.#error) {
      return;
    }

    this.#error = error;

    this.#waiting?.reject(error);
    this.#waiting = undefined;
  }
}
