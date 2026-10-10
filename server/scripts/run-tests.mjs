import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function findTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTests(entryPath);
      return entry.name.endsWith(".test.ts") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

const files = (await findTests("src")).sort();
if (files.length === 0) {
  throw new Error("No server tests were found under src/");
}

const runner = process.platform === "win32" ? "tsx.cmd" : "tsx";
const result = spawnSync(
  runner,
  ["--test", "--test-concurrency=1", ...files],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
