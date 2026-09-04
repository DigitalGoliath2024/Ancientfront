// Add global mocks or configuration here if needed
import "vitest-canvas-mock";
import { setOpenFrontAccountApiEnabled } from "../src/core/OpenFrontAccountApi";

// Unit tests exercise Auth/Api against mocked fetch and assume the account
// API is reachable. The live client/server default remains off.
setOpenFrontAccountApiEnabled(true);
