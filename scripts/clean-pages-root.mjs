import { rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

for (const entry of [
  ".pages-root",
  "assets",
  "index.html",
  "404.html",
  "favicon.ico",
  "robots.txt",
  "_headers",
  ".nojekyll",
]) {
  rmSync(join(root, entry), { recursive: true, force: true });
}
