import * as dotenv from "dotenv";
import { JWK } from "jose";
import { z } from "zod";
import { GameEnv, parseGameEnv } from "../core/configuration/Config";
import { isOpenFrontAccountApiEnabled } from "../core/OpenFrontAccountApi";
import { GameID } from "../core/Schemas";
import { generateID, simpleHash } from "../core/Util";

// ESM imports run before Server.ts's dotenv.config(). Hostinger also often
// omits GAME_ENV from the process environment, so load .env here first.
dotenv.config({ quiet: true });

const TURNSTILE_ALWAYS_PASS = "1x00000000000000000000AA";

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

const JwksSchema = z.object({
  keys: z
    .object({
      alg: z.literal("EdDSA"),
      crv: z.literal("Ed25519"),
      kty: z.literal("OKP"),
      x: z.string(),
    })
    .array()
    .min(1),
});

export class ServerEnv {
  private static publicKey: JWK | null = null;

  // Values that also flow to the client via index.html, but on the server
  // are read from process.env directly. Server code never reaches into
  // ClientEnv — that's reserved for the browser/worker hydrated path.
  //
  // TODO: the following methods are duplicated on ClientEnv. The two classes
  // read from different sources (process.env vs window.BOOTSTRAP_CONFIG) but
  // the derived logic is identical. Consolidate into a shared helper that
  // takes a source so we don't have to keep them in sync by hand.
  static env(): GameEnv {
    const raw =
      firstNonEmpty(process.env.GAME_ENV) ??
      (process.env.NODE_ENV === "production" ? "prod" : "dev");
    return parseGameEnv(raw);
  }
  static gameEnvName(): string {
    switch (ServerEnv.env()) {
      case GameEnv.Dev:
        return "dev";
      case GameEnv.Preprod:
        return "staging";
      case GameEnv.Prod:
        return "prod";
    }
  }
  static numWorkers(): number {
    const raw = firstNonEmpty(process.env.NUM_WORKERS) ?? "1";
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid NUM_WORKERS: ${raw}`);
    }
    return n;
  }
  static turnstileSiteKey(): string {
    return (
      firstNonEmpty(process.env.TURNSTILE_SITE_KEY) ?? TURNSTILE_ALWAYS_PASS
    );
  }
  static jwtAudience(): string {
    const host = firstNonEmpty(process.env.HOST, process.env.HOSTNAME)?.replace(
      /^https?:\/\//,
      "",
    );
    const hostName = host?.split(":")[0];
    const v =
      firstNonEmpty(process.env.DOMAIN) ??
      (hostName && hostName !== "localhost" ? hostName : undefined) ??
      "localhost";
    return v;
  }
  static instanceId(): string {
    return process.env.INSTANCE_ID ?? "";
  }
  static workerId(): number | undefined {
    const raw = process.env.WORKER_ID;
    if (raw === undefined) return undefined;
    return parseInt(raw, 10);
  }
  static hostname(): string {
    return process.env.HOSTNAME ?? "";
  }
  static host(): string {
    return process.env.HOST ?? "";
  }
  static cdnBase(): string {
    return process.env.CDN_BASE ?? "";
  }
  static jwtIssuer(): string {
    const audience = ServerEnv.jwtAudience();
    return audience === "localhost"
      ? "http://localhost:8787"
      : `https://api.${audience}`;
  }
  static async jwkPublicKey(): Promise<JWK> {
    if (!isOpenFrontAccountApiEnabled()) {
      throw new Error("OpenFront account API disabled");
    }
    if (ServerEnv.publicKey) return ServerEnv.publicKey;
    const jwksUrl = ServerEnv.jwtIssuer() + "/.well-known/jwks.json";
    console.log(`Fetching JWKS from ${jwksUrl}`);
    const response = await fetch(jwksUrl);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`JWKS fetch failed: ${response.status} ${body}`);
    }
    const result = JwksSchema.safeParse(await response.json());
    if (!result.success) {
      const error = z.prettifyError(result.error);
      console.error("Error parsing JWKS", error);
      throw new Error("Invalid JWKS");
    }
    ServerEnv.publicKey = result.data.keys[0];
    return ServerEnv.publicKey;
  }
  static turnIntervalMs(): number {
    return 100;
  }
  static gameCreationRate(): number {
    return ServerEnv.env() === GameEnv.Dev ? 5 * 1000 : 2 * 60 * 1000;
  }
  static workerIndex(gameID: GameID): number {
    return simpleHash(gameID) % ServerEnv.numWorkers();
  }
  static workerPath(gameID: GameID): string {
    return `w${ServerEnv.workerIndex(gameID)}`;
  }
  static workerPort(gameID: GameID): number {
    return ServerEnv.workerPortByIndex(ServerEnv.workerIndex(gameID));
  }
  static workerPortByIndex(index: number): number {
    return 3001 + index;
  }
  // Generate a game id that hashes to `workerId`, so requests for the game route
  // back to this worker. Rejection sampling: each id lands on a uniformly-random
  // worker, so the expected number of tries is numWorkers; the cap scales with
  // the worker count to keep the failure chance negligible (~e^-100). Returns
  // null if none was found (effectively never).
  static generateGameIdForWorker(workerId: number): GameID | null {
    const maxAttempts = ServerEnv.numWorkers() * 100;
    for (let i = 0; i < maxAttempts; i++) {
      const id = generateID();
      if (ServerEnv.workerIndex(id) === workerId) return id;
    }
    return null;
  }

  // Server-only env values
  static domain(): string {
    return ServerEnv.jwtAudience();
  }
  static subdomain(): string {
    return process.env.SUBDOMAIN ?? "";
  }
  static otelEnabled(): boolean {
    return (
      ServerEnv.env() !== GameEnv.Dev &&
      Boolean(ServerEnv.otelEndpoint()) &&
      Boolean(ServerEnv.otelAuthHeader())
    );
  }
  static otelEndpoint(): string {
    return process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "";
  }
  static otelAuthHeader(): string {
    return process.env.OTEL_AUTH_HEADER ?? "";
  }
  static gitCommit(): string {
    return firstNonEmpty(process.env.GIT_COMMIT) ?? "prod";
  }
  static apiKey(): string {
    return process.env.API_KEY ?? "";
  }
  // Long-lived shared secret for the trusted admin bot HTTP API.
  // Undefined when unset, which disables the admin bot API entirely.
  static adminBotKey(): string | undefined {
    const v = process.env.ADMIN_BOT_API_KEY;
    return v && v.length > 0 ? v : undefined;
  }
  static adminBotHeader(): string {
    return "x-admin-bot-key";
  }
  static allowedFlares(): string[] | undefined {
    const raw = process.env.ALLOWED_FLARES;
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
