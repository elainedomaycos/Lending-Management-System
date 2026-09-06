import { execSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, "..");
const repoRoot = path.resolve(frontendDir, "..", "..");
const apiBundle = path.resolve(repoRoot, "artifacts", "api-server", "dist", "app.mjs");
const apiOut = path.resolve(frontendDir, "api", "app.mjs");

execSync("pnpm --filter @workspace/api-server run build", {
  cwd: repoRoot,
  stdio: "inherit",
});

await mkdir(path.dirname(apiOut), { recursive: true });
await copyFile(apiBundle, apiOut);

execSync("pnpm exec vite build --config vite.config.ts", {
  cwd: frontendDir,
  stdio: "inherit",
});