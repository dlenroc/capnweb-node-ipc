import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const filesystemSockets = new Set<string>();

function cleanupAll() {
  for (const path of filesystemSockets) {
    try {
      rmSync(path, { force: true });
    } catch {}
  }

  filesystemSockets.clear();
}

export function resolveAddress(address: string): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\${address}`;
  }

  if (process.platform === "linux") {
    return `\0${address}`;
  }

  return `/tmp/${address}.sock`;
}

export function createEndpoint(): string {
  const address = randomUUID();

  if (process.platform !== "win32" && process.platform !== "linux") {
    if (filesystemSockets.size === 0) {
      process.once("exit", cleanupAll);
    }

    filesystemSockets.add(resolveAddress(address));
  }

  return address;
}

export function cleanupEndpoint(address: string): void {
  if (process.platform === "win32" || process.platform === "linux") {
    return;
  }

  const path = resolveAddress(address);

  filesystemSockets.delete(path);

  try {
    rmSync(path, { force: true });
  } catch {}

  if (filesystemSockets.size === 0) {
    process.off("exit", cleanupAll);
  }
}
