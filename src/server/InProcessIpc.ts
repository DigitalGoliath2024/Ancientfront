import { EventEmitter } from "node:events";
import type { Worker } from "cluster";
import { ServerEnv } from "./ServerEnv";

export type WorkerIpc = {
  sendToMaster: (msg: unknown) => void;
  onMasterMessage: (handler: (msg: unknown) => void) => void;
};

export const clusterWorkerIpc: WorkerIpc = {
  sendToMaster(msg) {
    process.send?.(msg);
  },
  onMasterMessage(handler) {
    process.on("message", handler);
  },
};

/** LiteSpeed/Hostinger + cluster.fork() starts extra primaries that fight over PORT. */
export function shouldRunInProcess(): boolean {
  if (process.env.DISABLE_CLUSTER === "1") return true;
  if (process.env.LSNODE_ROOT || process.env.LSNODE_VERSION) return true;
  return ServerEnv.numWorkers() === 1;
}

export function createInProcessIpc(): {
  ipc: WorkerIpc;
  workerHandle: Worker;
} {
  const toWorker = new EventEmitter();
  const toMaster = new EventEmitter();

  const ipc: WorkerIpc = {
    sendToMaster(msg) {
      toMaster.emit("message", msg);
    },
    onMasterMessage(handler) {
      toWorker.on("message", handler);
    },
  };

  const workerHandle = {
    send(msg: unknown, cb?: (err: Error | null) => void) {
      toWorker.emit("message", msg);
      cb?.(null);
      return true;
    },
    kill() {},
    on(event: string, listener: (msg: unknown) => void) {
      if (event === "message") {
        toMaster.on("message", listener);
      }
      return workerHandle;
    },
    process: { pid: process.pid, env: { WORKER_ID: "0" } },
  };

  return { ipc, workerHandle: workerHandle as unknown as Worker };
}
