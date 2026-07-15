import braPantyPrompt from "@/prompts/Bra-panty-Prompt.txt?raw";
import braPrompt from "@/prompts/Bra-prompt.txt?raw";
import pushupBraOnlyPrompt from "@/prompts/Pushup-Bra-Only-Prompt.txt?raw";
import pushupSetPrompt from "@/prompts/Pushup-Set.txt?raw";

import {
  BRANDS,
  DECK_SHOT_LABELS,
  type AspectId,
  type Brand,
  type DeckShotKey,
  type ShotPresetContent,
  type ShootType,
  buildBrandLock,
} from "@/lib/studio";

type PromptSourceId = "bra" | "bra_panty" | "panty" | "pushup_bra_only" | "pushup_set";

interface PromptSource {
  id: PromptSourceId;
  fileName: string;
  raw: string;
  headings: string[];
}

interface ComposeDeckPromptOptions {
  shootType: ShootType;
  pushupBraOnly: boolean;
  deckShot: DeckShotKey;
  brand: Brand;
  aspect: AspectId;
  userNote?: string;
  regenerationNote?: string;
  presetContent?: ShotPresetContent;
}

const BRA_SOURCE: PromptSource = {
  id: "bra",
  fileName: "Bra-prompt.txt",
  raw: braPrompt,
  headings: [
    "BRA ONLY FRONT PROMPT",
    "BRA ONLY SIDE 1 PROMPT",
    "BRA ONLY SIDE 2 PROMPT",
    "BRA ONLY BACK PROMPT",
    "BRA ONLY MOOD PROMPT",
    "BRA ONLY ZOOM PROMPT",
    "BRA ONLY MOCKUP PROMPT",
  ],
};

const PUSHUP_BRA_ONLY_SOURCE: PromptSource = {
  id: "pushup_bra_only",
  fileName: "Pushup-Bra-Only-Prompt.txt",
  raw: pushupBraOnlyPrompt,
  headings: [
    "FRONT PUSH UP PROMPT",
    "SIDE 1 PUSH UP PROMPT",
    "SIDE 2 PUSH UP PROMPT",
    "BACK PUSH UP PROMPT",
    "MOOD PUSH UP PROMPT",
    "ZOOM PUSH UP PROMPT",
    "MOCKUP PROMPT",
  ],
};

const PUSHUP_SET_SOURCE: PromptSource = {
  id: "pushup_set",
  fileName: "Pushup-Set.txt",
  raw: pushupSetPrompt,
  headings: [
    "FRONT PUSH UP PROMPT",
    "SIDE 1 PUSH UP PROMPT",
    "SIDE 2 PUSH UP PROMPT",
    "BACK PUSH UP PROMPT",
    "MOOD PUSH UP PROMPT",
    "ZOOM PUSH UP PROMPT",
    "MOCKUP PROMPT",
  ],
};

const BRA_PANTY_SOURCE: PromptSource = {
  id: "bra_panty",
  fileName: "Bra-panty-Prompt.txt",
  raw: braPantyPrompt,
  headings: [
    "SIDE VIEW PROMPT",
    "SIDE VIEW 2 PROMPT",
    "BACK VIEW PROMPT",
    "Front View PROMPT",
    "FRONT PUSH-UP PROMPT",
    "MOOD SHOOT PROMPT",
    "BRA PANTY ZOOM PROMPT",
    "BRA PANTY MOCKUP PROMPT",
    "PANTY ONLY FRONT VIEW PROMPT",
    "PANTY ONLY BACK VIEW PROMPT",
    "PANTY ONLY SIDE VIEW PROMPT",
    "PANTY ONLY MOOD VIEW PROMPT",
    "ZOOM PROMPT",
    "MOCKUP PROMPT",
  ],
};

const PANTY_SOURCE: PromptSource = {
  ...BRA_PANTY_SOURCE,
  id: "panty",
};

function cleanHeading(value: string): string {
  return value
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function headingMatches(line: string, heading: string): boolean {
  const cleanedLine = cleanHeading(line);
  const cleanedHeading = cleanHeading(heading);
  return cleanedLine === cleanedHeading || cleanedLine.startsWith(`${cleanedHeading} `);
}

function lineStarts(source: string): { line: string; start: number }[] {
  const starts: { line: string; start: number }[] = [];
  let index = 0;

  for (const line of source.split("\n")) {
    starts.push({ line, start: index });
    index += line.length + 1;
  }

  return starts;
}

function findHeadingStart(
  starts: { line: string; start: number }[],
  heading: string,
  after = -1,
): number {
  const match = starts.find(({ line, start }) => start > after && headingMatches(line, heading));
  return match?.start ?? -1;
}

function extractSection(source: PromptSource, heading: string): string {
  const starts = lineStarts(source.raw);
  const start = findHeadingStart(starts, heading);
  if (start < 0) return source.raw.trim();

  const nextStarts = source.headings
    .filter((candidate) => cleanHeading(candidate) !== cleanHeading(heading))
    .map((candidate) => findHeadingStart(starts, candidate, start))
    .filter((candidate) => candidate >= 0);

  const end = nextStarts.length > 0 ? Math.min(...nextStarts) : source.raw.length;
  return source.raw.slice(start, end).trim();
}

function getPromptSource(shootType: ShootType, pushupBraOnly: boolean): PromptSource {
  if (shootType === "bra") return BRA_SOURCE;
  if (shootType === "pushup") return pushupBraOnly ? PUSHUP_BRA_ONLY_SOURCE : PUSHUP_SET_SOURCE;
  if (shootType === "panty") return PANTY_SOURCE;
  return BRA_PANTY_SOURCE;
}

function sectionHeading(sourceId: PromptSourceId, deckShot: DeckShotKey): string {
  if (sourceId === "panty") {
    switch (deckShot) {
      case "side1":
        return "PANTY ONLY SIDE VIEW PROMPT";
      case "side2":
        return "PANTY ONLY FRONT VIEW PROMPT";
      case "mood":
        return "PANTY ONLY MOOD VIEW PROMPT";
      case "back":
        return "PANTY ONLY BACK VIEW PROMPT";
      case "zoom":
        return "ZOOM PROMPT";
    }
  }

  if (sourceId === "bra_panty") {
    switch (deckShot) {
      case "side1":
        return "SIDE VIEW PROMPT";
      case "side2":
        return "SIDE VIEW 2 PROMPT";
      case "mood":
        return "MOOD SHOOT PROMPT";
      case "zoom":
        return "BRA PANTY ZOOM PROMPT";
      case "back":
        return "BACK VIEW PROMPT";
    }
  }

  if (sourceId === "bra") {
    switch (deckShot) {
      case "side1":
        return "BRA ONLY SIDE 1 PROMPT";
      case "side2":
        return "BRA ONLY SIDE 2 PROMPT";
      case "mood":
        return "BRA ONLY MOOD PROMPT";
      case "zoom":
        return "BRA ONLY ZOOM PROMPT";
      case "back":
        return "BRA ONLY BACK PROMPT";
    }
  }

  if (sourceId === "pushup_bra_only") {
    switch (deckShot) {
      case "side1":
        return "SIDE 1 PUSH UP PROMPT — BRA ONLY";
      case "side2":
        return "SIDE 2 PUSH UP PROMPT — BRA ONLY";
      case "mood":
        return "MOOD PUSH UP PROMPT — BRA ONLY";
      case "zoom":
        return "ZOOM PUSH UP PROMPT — (UNCHANGED — BRA ONLY BY DEFAULT)";
      case "back":
        return "BACK PUSH UP PROMPT — BRA ONLY";
    }
  }

  switch (deckShot) {
    case "side1":
      return "SIDE 1 PUSH UP PROMPT";
    case "side2":
      return "SIDE 2 PUSH UP PROMPT";
    case "mood":
      return "MOOD PUSH UP PROMPT";
    case "zoom":
      return "ZOOM PUSH UP PROMPT";
    case "back":
      return "BACK PUSH UP PROMPT";
  }
}

function resolvePlaceholders(text: string, brand: Brand): string {
  return text
    .replace(
      /\{\{BACKGROUND_AND_LIGHTING\}\}/g,
      `Background: ${brand.bg} (${brand.name} brand background), clean seamless studio backdrop, no props or clutter. Lighting: soft, even, flattering studio lighting with no harsh shadows, consistent with ${brand.name}'s "${brand.overallLookFeel}" identity.`,
    )
    .replace(/\{\{BRAND_FONT_COLOR\}\}/g, brand.fg);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAllInsensitive(text: string, search: string, replacement: string): string {
  return text.replace(new RegExp(escapeRegExp(search), "gi"), replacement);
}

function applyBrandSpecification(text: string, brand: Brand): string {
  let next = text;

  for (const catalogBrand of BRANDS) {
    next = replaceAllInsensitive(next, catalogBrand.fg, brand.fg);
    next = replaceAllInsensitive(next, catalogBrand.bg, brand.bg);
    next = replaceAllInsensitive(next, catalogBrand.headingsDisplay, brand.headingsDisplay);
    next = replaceAllInsensitive(next, catalogBrand.bodyUi, brand.bodyUi);
    next = replaceAllInsensitive(next, `${catalogBrand.name} brand`, `${brand.name} brand`);
    next = replaceAllInsensitive(next, catalogBrand.paletteNotes, brand.paletteNotes);
    next = replaceAllInsensitive(next, catalogBrand.overallLookFeel, brand.overallLookFeel);
  }

  return normalizeRemainingHexCodes(next, brand);
}

function normalizeRemainingHexCodes(text: string, brand: Brand): string {
  return text
    .split("\n")
    .map((line) => {
      let next = line;

      next = next.replace(
        /(background(?:\s+color)?|backdrop|wall|bedroom|studio(?:\s+backdrop)?|negative[- ]space|breathing space|text panel|right panel|left panel)([^#\n]*?)#[0-9a-f]{6}/gi,
        (_match, label: string, middle: string) => `${label}${middle}${brand.bg}`,
      );
      next = next.replace(
        /(font|text color|color|callout|line|icon|dot|fill|stroke|border|ring|badge|heading|sub-heading|feature text|benefit text)([^#\n]*?)#[0-9a-f]{6}/gi,
        (_match, label: string, middle: string) => `${label}${middle}${brand.fg}`,
      );

      const hasHex = /#[0-9a-f]{6}/i.test(next);
      if (!hasHex) return next;

      if (/(background|backdrop|wall|bedroom|studio|negative[- ]space|breathing space|panel)/i.test(next)) {
        return next.replace(/#[0-9a-f]{6}/gi, brand.bg);
      }

      if (/(font|text|color|callout|line|icon|dot|fill|stroke|border|ring|badge|heading|sub-heading|feature|benefit)/i.test(next)) {
        return next.replace(/#[0-9a-f]{6}/gi, brand.fg);
      }

      return next;
    })
    .join("\n");
}

function brandOverride(brand: Brand): string {
  return [
    "IMPORTANT SELECTED BRAND OVERRIDE:",
    "Use the source prompt above exactly for pose, product, crop, callout structure, and reference-image rules.",
    "The source prompt section has already been rewritten with the selected brand fonts and hex codes. Follow those rewritten values exactly.",
    "If any old brand value still appears, ignore it and replace it with the selected brand values below.",
    buildBrandLock(brand),
    `HARD-CODED TEXT HEX: every visible heading, sub-heading, callout label, callout content, feature text, benefit text, callout body copy, icon fill, icon stroke, circular icon fill, border ring, callout line, pointer dot, badge text, and brand chip text must use exactly ${brand.fg}. Heading, sub-heading, and every callout text line must share this same ${brand.fg} hex. Do not use blue, black, grey, white, or any source-prompt color for text/graphics unless it equals ${brand.fg}.`,
    `HARD-CODED BACKGROUND HEX: every studio backdrop, lifestyle wall, negative-space panel, right/left text panel, product panel, flat background, and visible empty background area must use exactly ${brand.bg}. Do not use any source-prompt background hex, tint, approximate color, or generated substitute unless it equals ${brand.bg}.`,
    `Use ${brand.headingsDisplay} for headlines/display text and ${brand.bodyUi} for sub-headings/body/callout text.`,
  ].join("\n");
}

function stylePresetOverride(content: ShotPresetContent, brand: Brand): string {
  const callouts = content.callouts
    .map((callout, index) => (callout.trim() ? `Callout ${index + 1}: ${callout.trim()}` : ""))
    .filter(Boolean);
  const iconPlan = buildCalloutIconPlan(content, brand);

  return [
    "SELECTED STYLE PRESET CONTENT OVERRIDE — CRITICAL:",
    `Selected style: ${content.styleName}.`,
    "Use the exact source prompt section above for pose, crop, model position, negative space, callout count, callout direction, icon/line style, headline position, sub-heading position, and all layout/placement rules.",
    "Only replace the written copy/content inside that existing layout with the selected style content below.",
    "Do not invent extra labels, extra callouts, badges, captions, logos, or alternate wording.",
    "Do not move callouts, icons, lines, dots, or text blocks away from the source prompt layout. Keep every visual element in the same placement zones described in the source prompt.",
    `All selected-style text, callout content, icons, dots, lines, and callout graphics must use the selected brand font hex ${brand.fg}; headings use ${brand.headingsDisplay}, sub-heading/callouts use ${brand.bodyUi}; backgrounds use ${brand.bg}.`,
    `Heading: ${content.heading || "Use no heading text."}`,
    content.subHeading ? `Sub-heading: ${content.subHeading}` : "Sub-heading: Use no sub-heading text.",
    callouts.length > 0 ? callouts.join("\n") : "Callouts: Use no callout text.",
    iconPlan,
  ].join("\n");
}

function normalizeCalloutZone(zone?: string): string {
  return (zone ?? "auto").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function iconConceptForCallout(callout: string, zone?: string): string {
  const text = `${normalizeCalloutZone(zone)} ${callout}`.toLowerCase();

  if (/armhole|underarm|rash|chafe|digging/.test(text)) {
    return "a smooth underarm curve / armhole comfort symbol";
  }
  if (/bottom|band|underbust|elastic/.test(text)) {
    return "a curved bra band / underbust support symbol";
  }
  if (/strap|shoulder/.test(text)) {
    return "an adjustable shoulder strap symbol";
  }
  if (/hook|closure|adjustable|3[\s_/-]*level/.test(text)) {
    return "three hook-and-eye closure rows";
  }
  if (/wing|side[\s_/-]*wing|back[\s_/-]*smooth|smoothen/.test(text)) {
    return "wide side wing panels smoothing the back";
  }
  if (/pad|padding|lift|push/.test(text)) {
    return "a lifted padded cup / gentle lift symbol";
  }
  if (/v[\s_/-]*neck|neckline/.test(text)) {
    return "a clean V-neckline outline";
  }
  if (/coverage|cover/.test(text)) {
    return "a full coverage cup outline";
  }
  if (/wire[\s_/-]*free|w[\s_/-]*hold|support/.test(text)) {
    return "a wire-free support arc";
  }
  if (/u[\s_/-]*back/.test(text)) {
    return "a back-view U-shape strap support symbol";
  }
  if (/fabric|seamless|stitch|no[\s_/-]*stitch|smooth|polyamide|breath|cotton|weave/.test(text)) {
    return "a seamless fabric weave / smooth wave symbol";
  }
  if (/grip|gripper|anti[\s_/-]*slip/.test(text)) {
    return "a grip-strip texture symbol";
  }
  if (/spill|spillage|bulge/.test(text)) {
    return "a contained side-cup anti-spillage symbol";
  }

  return "a simple product-feature symbol inferred from the exact callout words";
}

function buildCalloutIconPlan(content: ShotPresetContent, brand: Brand): string {
  const rows = content.callouts
    .map((callout, index) => {
      const trimmed = callout.trim();
      if (!trimmed) return "";
      const zone = content.calloutZones?.[index];
      return `Callout ${index + 1} icon: auto-detect from "${trimmed}" -> draw ${iconConceptForCallout(trimmed, zone)}.`;
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return "AUTO-DETECTED ICON RULE: no selected callout text is present, so do not render any callout icons.";
  }

  return [
    "AUTO-DETECTED ICON RULE — CRITICAL:",
    "Do not copy fixed icon examples from the source prompt when selected style content is active.",
    "For each callout, choose the icon symbol from that callout's actual words and garment zone. The icon meaning must match the callout content exactly.",
    `Every icon must be a solid ${brand.fg} circular icon with a clear white interior line illustration. The icon fill, border ring, connector line, and touch/connector dots must all use ${brand.fg}; never black, grey, blue, magenta, or any other color unless it is exactly ${brand.fg}.`,
    ...rows,
  ].join("\n");
}

function finalBrandRenderContract(
  brand: Brand,
  deckShot: DeckShotKey,
  content?: ShotPresetContent,
): string {
  const selectedCopy = content
    ? [
        content.heading,
        content.subHeading,
        ...content.callouts,
      ]
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return [
    "FINAL RENDER CONTRACT — HIGHEST PRIORITY:",
    `Selected brand is ${brand.name}. Use ONLY this brand's visual specification in the final image.`,
    `FINAL TEXT/CALLOUT/ICON HEX: ${brand.fg} only. Headings, sub-headings, every callout content line, feature text, benefit text, circular icon fills, icon strokes, icon borders, callout lines, connector dots, badges, and brand chips must all use the same ${brand.fg}.`,
    `FINAL LINE COLOR LOCK: every connector line on every pose, especially Back and Side 1, must use ${brand.fg} exactly. Do not render black, grey, blue, pink, magenta, faded purple, gradient, transparent, or approximate lines.`,
    `FINAL BACKGROUND HEX: ${brand.bg} only for studio backgrounds, text panels, negative-space areas, product panels, empty breathing space, and lifestyle wall/backdrop areas. The background must visibly read as ${brand.bg}, not an approximate blue/beige/grey substitute.`,
    `FINAL FONTS: headings/display text must use ${brand.headingsDisplay}; sub-headings, body copy, and callouts must use ${brand.bodyUi}. Do not use default system fonts, black text, grey text, blue text, or any source-prompt font/color if it differs from this brand.`,
    "Do not render font names, hex codes, brand-spec table labels, UI labels, numbers inside callout icons, arrows as text characters, or placeholder text.",
    deckShot === "side1"
      ? [
          "SIDE 1 ICON/CALLOUT LOCK:",
          "Render exactly three product feature callout groups, matching the source prompt positions.",
          "Do not omit icons. Side 1 must contain exactly three visible circular icons, one attached to each callout group.",
          `Each Side 1 icon must be a clean circular icon with solid ${brand.fg} fill and a simple white line-art lingerie/product-feature symbol inside.`,
          "The white line-art symbol inside each icon must be auto-detected from that callout's selected text, not copied from the source prompt examples.",
          "Do NOT render numbered icon badges such as 1, 2, or 3. Do NOT render arrow glyphs, random symbols, broken brackets, or text inside the icons.",
          `Every Side 1 connector line and product touch dot must use ${brand.fg}. Lines must be thin, clean, and connected to the correct product zone.`,
        ].join("\n")
      : "",
    deckShot === "back"
      ? [
          "BACK VIEW COLOR/GRAPHIC LOCK:",
          `Back headline, sub-heading, all three feature labels, benefit lines, circular icon fills, icon rings, interior icon strokes, and connector lines must use ${brand.fg} only, with white interior icon drawings only.`,
          "Do not use black text for Back callouts. Do not use pink/magenta/purple variants unless the exact selected brand hex is that value.",
          "Back connector lines must be thin, clean, and visible in the selected brand hex; no faded alternate color and no mismatched line color.",
        ].join("\n")
      : "",
    content
      ? [
          "SELECTED STYLE COPY IS THE ONLY COPY ALLOWED:",
          "Replace all example/source-prompt marketing copy with the selected style content below.",
          selectedCopy.length > 0
            ? selectedCopy.map((item, index) => `Allowed text ${index + 1}: "${item}"`).join("\n")
            : "Allowed text: none. Do not render any headline, sub-heading, or callout copy.",
          "Do NOT render old source-prompt text unless it appears verbatim in the allowed selected-style text list above.",
          'Forbidden old source copy examples include: "Elastic-Free Construction", "No Digging. No Marks. No Itching", "Elastic-free Armhole", "Elastic-free Bottom Band", "Seamless Design", "Rashfree Comfort", "Seamless Support", and "Invisible under Outfits".',
          "Do not duplicate callout content. Do not merge multiple callouts into one paragraph. Keep each selected callout as its own clean callout group.",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function moodBackgroundLock(brand: Brand): string {
  return [
    "UNIVERSAL MOOD BACKGROUND LOCK — BRAND-SPECIFIC:",
    "For every Mood deck image in every mode, use the same clean airy bedroom language:",
    `Background wall/backdrop must be a smooth, bright, softly blurred ${brand.bg} brand-color wall, matching ${brand.name}'s background hex exactly.`,
    "Use a clean white or very light ivory bed with soft bedding at the lower frame, like a premium morning lifestyle shoot.",
    "The setting should feel fresh, open, minimal, and polished: no yellow beige cast, no dark warm room, no clutter, no decorative props, no plants, no visible curtains, no busy furniture, no colored panels.",
    "Lighting must be soft bright daylight, clean and even, with gentle natural shadows only. The background should look like the reference clean bed mood image, recolored through the selected brand background hex.",
    `All background panels, visible wall areas, and empty negative-space zones must stay in ${brand.bg}; all text, dots, callout lines, and Mood graphics must stay in ${brand.fg}.`,
  ].join("\n");
}

export function composeDeckPrompt({
  shootType,
  pushupBraOnly,
  deckShot,
  brand,
  aspect,
  userNote,
  regenerationNote,
  presetContent,
}: ComposeDeckPromptOptions): { prompt: string; sourceFile: string; section: string } {
  const source = getPromptSource(shootType, pushupBraOnly);
  const section = sectionHeading(source.id, deckShot);
  const sourcePrompt = applyBrandSpecification(resolvePlaceholders(extractSection(source, section), brand), brand);
  const modeLock =
    source.id === "pushup_bra_only" && deckShot === "mood"
      ? [
          "PUSHUP BRA-ONLY MOOD ROUTE LOCK:",
          "This image must use the MOOD PUSH UP PROMPT — BRA ONLY section from Pushup-Bra-Only-Prompt.txt only.",
          "Do not use Side 1, Side 2, Back, Zoom, Pushup Set, Bra+Panty, or Panty prompt layout for this Mood image.",
        ].join("\n")
      : "";
  const sourceLock =
    source.id === "pushup_set"
      ? [
          "PUSHUP SET ROUTE LOCK:",
          "This Pushup mode includes the panty reference and must use Pushup-Set.txt only.",
          "Use the exact selected Pushup-Set.txt section for content layout, icons, callout lines, dots, text placement, model crop, bra placement, and panty placement.",
          "Do not switch to Pushup-Bra-Only-Prompt.txt, Bra-prompt.txt, Bra-panty-Prompt.txt, or any panty-only layout.",
        ].join("\n")
      : "";
  const controls = [
    "DECK SHOT LOCK:",
    `Deck shot: ${DECK_SHOT_LABELS[deckShot]}.`,
    `Prompt source file: ${source.fileName}.`,
    `Prompt source section: ${section}.`,
    `Aspect selected in Studio Flow: ${aspect}.`,
    "Fixed image quality: generate a native, sharp 2K ecommerce image with a 2048px short edge. Do not return a blurry, low-resolution, soft, compressed, or pixelated image.",
    presetContent
      ? "Content/layout lock: render the selected style preset text inside the exact headline, sub-heading, and callout placement described by the source prompt. The source prompt layout is mandatory."
      : "",
    "Generate only this deck shot. Keep model identity, product identity, and brand identity consistent with the rest of the deck.",
    userNote?.trim() ? `User refinement note: ${userNote.trim()}` : "",
    regenerationNote?.trim() ? `Regeneration correction note: ${regenerationNote.trim()}` : "",
  ].filter(Boolean);

  const sections = [sourcePrompt, brandOverride(brand), controls.join("\n")];
  if (deckShot === "mood") sections.push(moodBackgroundLock(brand));
  if (modeLock) sections.push(modeLock);
  if (sourceLock) sections.push(sourceLock);
  if (presetContent) sections.push(stylePresetOverride(presetContent, brand));
  sections.push(finalBrandRenderContract(brand, deckShot, presetContent));

  return {
    prompt: sections.join("\n\n"),
    sourceFile: source.fileName,
    section,
  };
}
