import sharp from "sharp";
import { readdir, readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "public");
const targetRoot = path.join(root, "src/assets/optimized");
const widths = [96, 192, 384, 768, 1200, 1600];
const files = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(full);
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) files.push(full);
  }
}
await scan(sourceRoot);
await mkdir(targetRoot, { recursive: true });
let generated = 0;
for (const file of files) {
  const relative = path.relative(sourceRoot, file);
  const bytes = await readFile(file);
  const hash = createHash("sha256").update(bytes).update(`webp-v1:78:${widths.join(",")}`).digest("hex");
  const folder = path.join(targetRoot, relative);
  let saved;
  try { saved = await readFile(path.join(folder, "source.sha256"), "utf8"); } catch {}
  if (saved === hash) continue;
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  for (const width of widths) {
    const output = await sharp(bytes, { limitInputPixels: 80_000_000 })
      .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
    await writeFile(path.join(folder, `${width}.webp`), output);
  }
  await writeFile(path.join(folder, "source.sha256"), hash);
  generated++;
}
console.log(`Image variants ready: ${files.length} source images, ${generated} updated.`);
