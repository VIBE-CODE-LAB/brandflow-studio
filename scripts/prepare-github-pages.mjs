import { copyFileSync, cpSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicDir = join(process.cwd(), ".output", "public");
const assetsDir = join(publicDir, "assets");
const base = "/brandflow-studio";

if (!existsSync(assetsDir)) {
  throw new Error("Missing .output/public/assets. Run npm run build:pages first.");
}

const assets = readdirSync(assetsDir);
const entryScript = assets.find((name) => /^index-.*\.js$/.test(name));
const stylesheet = assets.find((name) => /^styles-.*\.css$/.test(name));
const routeScript = assets.find((name) => /^routes-.*\.js$/.test(name));

if (!entryScript || !stylesheet) {
  throw new Error("Could not find built index script or stylesheet in .output/public/assets.");
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio Flow - One-Canvas AI Photoshoot Kit</title>
    <meta
      name="description"
      content="Studio Flow is a streamlined AI photoshoot studio for innerwear brands."
    />
    <link rel="icon" href="${base}/favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap"
      onload="this.onload=null;this.rel='stylesheet'"
    />
    <noscript>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap"
      />
    </noscript>
    ${routeScript ? `<link rel="modulepreload" href="${base}/assets/${routeScript}" />` : ""}
    <link rel="stylesheet" href="${base}/assets/${stylesheet}" />
    <script type="module" src="${base}/assets/${entryScript}"></script>
  </head>
  <body>
    <main id="root"></main>
  </body>
</html>
`;

const rootHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio Flow - One-Canvas AI Photoshoot Kit</title>
    <meta
      name="description"
      content="Studio Flow is a streamlined AI photoshoot studio for innerwear brands."
    />
    <link rel="icon" href="${base}/favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <script>
      (() => {
        const base = "${base}/";
        const addLink = (rel, href, attrs = {}) => {
          const link = document.createElement("link");
          link.rel = rel;
          link.href = href;
          Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
          document.head.appendChild(link);
        };

        addLink("preload", "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600&display=swap", {
          as: "style",
          onload: "this.onload=null;this.rel='stylesheet'",
        });
        ${routeScript ? `addLink("modulepreload", base + "assets/${routeScript}");` : ""}
        addLink("stylesheet", base + "assets/${stylesheet}");

        const script = document.createElement("script");
        script.type = "module";
        script.src = base + "assets/${entryScript}";
        document.head.appendChild(script);
      })();
    </script>
  </head>
  <body>
    <main id="root"></main>
  </body>
</html>
`;

writeFileSync(join(publicDir, "index.html"), html);
copyFileSync(join(publicDir, "index.html"), join(publicDir, "404.html"));
writeFileSync(join(publicDir, ".nojekyll"), "");

// Also mirror the static artifact to the repository root. This keeps GitHub Pages
// working when the repository is configured as "Deploy from a branch: main / root".
rmSync(join(process.cwd(), "assets"), { recursive: true, force: true });
cpSync(assetsDir, join(process.cwd(), "assets"), { recursive: true });
writeFileSync(join(process.cwd(), "index.html"), rootHtml);
for (const fileName of ["404.html", "favicon.ico", "robots.txt", "_headers", ".nojekyll"]) {
  const source = join(publicDir, fileName);
  if (existsSync(source)) {
    copyFileSync(source, join(process.cwd(), fileName));
  }
}
