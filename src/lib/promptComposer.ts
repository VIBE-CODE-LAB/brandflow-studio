import braPantyPrompt from "@/prompts/Bra-panty-Prompt.txt?raw";
import braPrompt from "@/prompts/Bra-prompt.txt?raw";
import pushupBraOnlyPrompt from "@/prompts/Pushup-Bra-Only-Prompt.txt?raw";
import pushupSetPrompt from "@/prompts/Pushup-Set.txt?raw";

import {
  DECK_SHOT_LABELS,
  type AspectId,
  type Brand,
  type DeckShotKey,
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
  /** When true, ask Gemini for a clean product photo only — no headline/callouts/icons.
   *  Used when a style preset is driving the overlay, composited client-side afterward. */
  cleanPhoto?: boolean;
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

function cleanPhotoOverride(): string {
  return [
    "CLEAN PHOTO OVERRIDE — CRITICAL, TAKES PRIORITY OVER ANY CONFLICTING INSTRUCTION ABOVE:",
    "KEEP every instruction above about model pose, model position/zone, framing, crop, composition split (e.g. LEFT/RIGHT panel percentages), and the empty background space reserved around/beside the model for text — that reserved empty space must still exist in exactly the same place and size, because real text is drawn into it afterward in post-production.",
    "The ONLY thing to change: do not paint any actual text glyphs, headline, sub-heading, callout copy, callout lines, icons, badges, or watermark pixels into the image. Every zone that was going to hold text or an icon must instead stay perfectly plain — just the flat background/backdrop color, with nothing drawn there.",
    "Do NOT shrink, recenter, or enlarge the model to fill the space that was reserved for text — leave that space empty, not filled with more of the model or product.",
  ].join("\n");
}

function brandOverride(brand: Brand): string {
  return [
    "IMPORTANT SELECTED BRAND OVERRIDE:",
    "Use the source prompt above exactly for pose, product, crop, callout structure, and reference-image rules.",
    "If the source prompt mentions another brand, font, hex color, palette, or look/feel, replace those brand-specific values with the selected brand values below.",
    buildBrandLock(brand),
    `All visible typography, callout lines, icons, and text panels must use ${brand.fg}.`,
    `All studio/backdrop/text-panel backgrounds must use ${brand.bg}.`,
    `Use ${brand.headingsDisplay} for headlines/display text and ${brand.bodyUi} for sub-headings/body/callout text.`,
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
  cleanPhoto,
}: ComposeDeckPromptOptions): { prompt: string; sourceFile: string; section: string } {
  const source = getPromptSource(shootType, pushupBraOnly);
  const section = sectionHeading(source.id, deckShot);
  const sourcePrompt = resolvePlaceholders(extractSection(source, section), brand);
  const controls = [
    "DECK SHOT LOCK:",
    `Deck shot: ${DECK_SHOT_LABELS[deckShot]}.`,
    `Aspect selected in Studio Flow: ${aspect}.`,
    "Fixed image quality: generate a 2K final ecommerce image with a 2048px long edge, crisp fabric detail, clean product edges, and sharp brand text/callouts.",
    "Generate only this deck shot. Keep model identity, product identity, and brand identity consistent with the rest of the deck.",
    userNote?.trim() ? `User refinement note: ${userNote.trim()}` : "",
    regenerationNote?.trim() ? `Regeneration correction note: ${regenerationNote.trim()}` : "",
  ].filter(Boolean);

  const sections = [sourcePrompt, brandOverride(brand), controls.join("\n")];
  if (cleanPhoto) sections.push(cleanPhotoOverride());

  return {
    prompt: sections.join("\n\n"),
    sourceFile: source.fileName,
    section,
  };
}
