process.env.NODE_ENV = "development";

import { loadEnvFile } from "node:process";
import path from "node:path";

for (const file of [
  path.resolve(import.meta.dirname, "..", "..", "..", ".env.local"),
  path.resolve(import.meta.dirname, "..", "..", "..", ".env"),
  path.resolve(import.meta.dirname, "..", ".env.local"),
  path.resolve(import.meta.dirname, "..", ".env"),
]) {
  try {
    loadEnvFile(file);
    console.log(`[dev] loaded env from ${file}`);
    break;
  } catch {
    // file missing or unreadable; try the next candidate
  }
}

const { buildAll } = await import("../build.mjs");
await buildAll();
await import("../dist/index.mjs");