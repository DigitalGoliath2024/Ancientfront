/**
 * LiteSpeed (lsnode.js) loads this file with require(). Node can require()
 * ESM only if the graph has no top-level await. Import the bundled server
 * statically so listen() runs in this same process during module evaluation.
 */
import "./dist/server.mjs";
