import { afterEach, describe, expect, test, vi } from "vitest";
import { GameEnv } from "../../src/core/configuration/Config";
import { ServerEnv } from "../../src/server/ServerEnv";

describe("ServerEnv.env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("maps GAME_ENV when set", () => {
    vi.stubEnv("GAME_ENV", "prod");
    expect(ServerEnv.env()).toBe(GameEnv.Prod);
  });

  test("defaults to prod when GAME_ENV is unset and NODE_ENV is production", () => {
    vi.stubEnv("GAME_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(ServerEnv.env()).toBe(GameEnv.Prod);
  });
});

describe("ServerEnv.numWorkers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns parsed value when valid", () => {
    vi.stubEnv("NUM_WORKERS", "4");
    expect(ServerEnv.numWorkers()).toBe(4);
  });

  test("defaults to 1 when unset", () => {
    vi.stubEnv("NUM_WORKERS", "");
    expect(ServerEnv.numWorkers()).toBe(1);
  });

  test("throws on non-numeric", () => {
    vi.stubEnv("NUM_WORKERS", "abc");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });

  test("throws on zero", () => {
    vi.stubEnv("NUM_WORKERS", "0");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });

  test("throws on negative", () => {
    vi.stubEnv("NUM_WORKERS", "-2");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });
});

describe("ServerEnv.turnstileSiteKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns value when set", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site-key");
    expect(ServerEnv.turnstileSiteKey()).toBe("site-key");
  });

  test("defaults to Cloudflare test key when unset", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    expect(ServerEnv.turnstileSiteKey()).toBe("1x00000000000000000000AA");
  });
});

describe("ServerEnv.jwtAudience", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns DOMAIN when set", () => {
    vi.stubEnv("DOMAIN", "openfront.io");
    expect(ServerEnv.jwtAudience()).toBe("openfront.io");
  });

  test("defaults to localhost when DOMAIN unset", () => {
    vi.stubEnv("DOMAIN", "");
    vi.stubEnv("HOST", "");
    vi.stubEnv("HOSTNAME", "");
    expect(ServerEnv.jwtAudience()).toBe("localhost");
  });
});

describe("ServerEnv.jwtIssuer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("maps 'localhost' to http://localhost:8787", () => {
    vi.stubEnv("DOMAIN", "localhost");
    expect(ServerEnv.jwtIssuer()).toBe("http://localhost:8787");
  });

  test("derives api.<audience> for non-localhost", () => {
    vi.stubEnv("DOMAIN", "openfront.io");
    expect(ServerEnv.jwtIssuer()).toBe("https://api.openfront.io");
  });
});

describe("ServerEnv.allowedFlares", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns undefined when unset", () => {
    vi.stubEnv("ALLOWED_FLARES", "");
    expect(ServerEnv.allowedFlares()).toBeUndefined();
  });

  test("parses a single value", () => {
    vi.stubEnv("ALLOWED_FLARES", "admin");
    expect(ServerEnv.allowedFlares()).toEqual(["admin"]);
  });

  test("parses CSV", () => {
    vi.stubEnv("ALLOWED_FLARES", "admin,beta,internal");
    expect(ServerEnv.allowedFlares()).toEqual(["admin", "beta", "internal"]);
  });

  test("trims whitespace and drops empties", () => {
    vi.stubEnv("ALLOWED_FLARES", " admin , , beta ");
    expect(ServerEnv.allowedFlares()).toEqual(["admin", "beta"]);
  });
});
