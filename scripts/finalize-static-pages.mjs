import { copyFileSync, cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pagesDir = join(root, ".pages-root");
const builtHtml = join(pagesDir, "static-index.html");
const indexHtml = join(root, "index.html");
const notFoundHtml = join(root, "404.html");

if (!existsSync(builtHtml)) {
  throw new Error("Missing static-index.html. Run vite build --config vite.static.config.ts first.");
}

rmSync(join(root, "assets"), { recursive: true, force: true });
cpSync(join(pagesDir, "assets"), join(root, "assets"), { recursive: true });
copyFileSync(builtHtml, indexHtml);
copyFileSync(indexHtml, notFoundHtml);

for (const fileName of ["favicon.ico", "robots.txt"]) {
  const source = join(root, "public", fileName);
  if (existsSync(source)) {
    copyFileSync(source, join(root, fileName));
  }
}

writeFileSync(join(root, ".nojekyll"), "");
writeFileSync(
  join(root, "_headers"),
  ["/assets/*", "  Cache-Control: public, max-age=31536000, immutable", ""].join("\n"),
);
