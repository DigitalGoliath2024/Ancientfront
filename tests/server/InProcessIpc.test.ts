import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createInProcessIpc,
  shouldRunInProcess,
} from "../../src/server/InProcessIpc";

describe("shouldRunInProcess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("is true when NUM_WORKERS is 1", () => {
    vi.stubEnv("NUM_WORKERS", "1");
    vi.stubEnv("DISABLE_CLUSTER", "");
    vi.stubEnv("LSNODE_ROOT", "");
    vi.stubEnv("LSNODE_VERSION", "");
    expect(shouldRunInProcess()).toBe(true);
  });

  test("is false when NUM_WORKERS is 2", () => {
    vi.stubEnv("NUM_WORKERS", "2");
    vi.stubEnv("DISABLE_CLUSTER", "");
    vi.stubEnv("LSNODE_ROOT", "");
    vi.stubEnv("LSNODE_VERSION", "");
    expect(shouldRunInProcess()).toBe(false);
  });
});

describe("createInProcessIpc", () => {
  test("delivers worker ready to the master handle", () => {
    const { ipc, workerHandle } = createInProcessIpc();
    const received: unknown[] = [];
    workerHandle.on("message", (msg: unknown) => {
      received.push(msg);
    });
    ipc.sendToMaster({ type: "workerReady", workerId: 0 });
    expect(received).toEqual([{ type: "workerReady", workerId: 0 }]);
  });
});
