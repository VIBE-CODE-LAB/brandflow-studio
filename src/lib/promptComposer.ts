import braPantyPrompt from "@/prompts/Bra-panty-Prompt.txt?raw";
import braPrompt from "@/prompts/Bra-prompt.txt?raw";
import pushupBraOnlyPrompt from "@/prompts/Pushup-Bra-Only-Prompt.txt?raw";
import pushupSetPrompt from "@/prompts/Pushup-Set.txt?raw";

import {
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

function brandOverride(brand: Brand): string {
  return [
    "IMPORTANT SELECTED BRAND OVERRIDE:",
    "Use the source prompt above exactly for pose, product, crop, callout structure, and reference-image rules.",
    "If the source prompt mentions another brand, font, hex color, palette, or look/feel, replace those brand-specific values with the selected brand values below.",
    buildBrandLock(brand),
    `MANDATORY TEXT HEX: every visible heading, sub-heading, callout label, feature text, benefit text, icon stroke, callout line, pointer dot, badge text, and brand chip text must use exactly ${brand.fg}. Do not use blue, black, grey, white, or any source-prompt color for text unless it equals ${brand.fg}.`,
    `MANDATORY BACKGROUND HEX: all studio/backdrop/text-panel backgrounds must use exactly ${brand.bg}.`,
    `Use ${brand.headingsDisplay} for headlines/display text and ${brand.bodyUi} for sub-headings/body/callout text.`,
  ].join("\n");
}

function stylePresetOverride(content: ShotPresetContent, brand: Brand): string {
  const callouts = content.callouts
    .map((callout, index) => (callout.trim() ? `Callout ${index + 1}: ${callout.trim()}` : ""))
    .filter(Boolean);

  return [
    "SELECTED STYLE PRESET CONTENT OVERRIDE — CRITICAL:",
    `Selected style: ${content.styleName}.`,
    "Use the exact source prompt section above for pose, crop, model position, negative space, callout count, callout direction, icon/line style, headline position, sub-heading position, and all layout/placement rules.",
    "Only replace the written copy/content inside that existing layout with the selected style content below.",
    "Do not invent extra labels, extra callouts, badges, captions, logos, or alternate wording.",
    "Do not move callouts away from the source prompt layout. Keep every text block and callout in the same placement zones described in the source prompt.",
    `All selected-style text and callout graphics must use the selected brand font hex ${brand.fg}; headings use ${brand.headingsDisplay}, sub-heading/callouts use ${brand.bodyUi}.`,
    `Heading: ${content.heading || "Use no heading text."}`,
    content.subHeading ? `Sub-heading: ${content.subHeading}` : "Sub-heading: Use no sub-heading text.",
    callouts.length > 0 ? callouts.join("\n") : "Callouts: Use no callout text.",
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
  const sourcePrompt = resolvePlaceholders(extractSection(source, section), brand);
  const modeLock =
    source.id === "pushup_bra_only" && deckShot === "mood"
      ? [
          "PUSHUP BRA-ONLY MOOD ROUTE LOCK:",
          "This image must use the MOOD PUSH UP PROMPT — BRA ONLY section from Pushup-Bra-Only-Prompt.txt only.",
          "Do not use Side 1, Side 2, Back, Zoom, Pushup Set, Bra+Panty, or Panty prompt layout for this Mood image.",
        ].join("\n")
      : "";
  const controls = [
    "DECK SHOT LOCK:",
    `Deck shot: ${DECK_SHOT_LABELS[deckShot]}.`,
    `Prompt source file: ${source.fileName}.`,
    `Prompt source section: ${section}.`,
    `Aspect selected in Studio Flow: ${aspect}.`,
    "Fixed image quality: generate a native, sharp 2K ecommerce image with a 2048px long edge. Do not return a blurry, low-resolution, soft, compressed, or pixelated image.",
    presetContent
      ? "Content/layout lock: render the selected style preset text inside the exact headline, sub-heading, and callout placement described by the source prompt. The source prompt layout is mandatory."
      : "",
    "Generate only this deck shot. Keep model identity, product identity, and brand identity consistent with the rest of the deck.",
    userNote?.trim() ? `User refinement note: ${userNote.trim()}` : "",
    regenerationNote?.trim() ? `Regeneration correction note: ${regenerationNote.trim()}` : "",
  ].filter(Boolean);

  const sections = [sourcePrompt, brandOverride(brand), controls.join("\n")];
  if (modeLock) sections.push(modeLock);
  if (presetContent) sections.push(stylePresetOverride(presetContent, brand));

  return {
    prompt: sections.join("\n\n"),
    sourceFile: source.fileName,
    section,
  };
}
