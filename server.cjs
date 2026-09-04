/**
 * Alternate Hostinger entry if hPanel is set to a .cjs file.
 * LiteSpeed require()s CommonJS; this then loads the ESM server in-process.
 */
"use strict";

import("./dist/server.mjs").catch((error) => {
  console.error(error);
  process.exit(1);
});
