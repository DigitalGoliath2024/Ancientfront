import * as esbuild from "esbuild";
import path from "node:path";

await esbuild.build({
  absWorkingDir: process.cwd(),
  entryPoints: [path.join("src", "server", "Server.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: path.join("dist", "server.mjs"),
  logLevel: "info",
});
