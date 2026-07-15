// Loads brand display/body fonts from Google Fonts at runtime so canvas fillText()
// renders the correct typeface instead of silently falling back to a system font.
const loadedFamilies = new Set<string>();

export async function ensureGoogleFontsLoaded(families: string[]): Promise<void> {
  const toLoad = Array.from(new Set(families.filter(Boolean))).filter((f) => !loadedFamilies.has(f));
  if (toLoad.length === 0) return;

  const href = `https://fonts.googleapis.com/css2?${toLoad
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&")}&display=swap`;

  await new Promise<void>((resolve) => {
    if (document.querySelector(`link[data-studioflow-fonts="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.studioflowFonts = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });

  await Promise.all(
    toLoad.flatMap((f) => [
      document.fonts.load(`700 48px "${f}"`),
      document.fonts.load(`400 24px "${f}"`),
    ]),
  ).catch(() => undefined);

  toLoad.forEach((f) => loadedFamilies.add(f));
}
