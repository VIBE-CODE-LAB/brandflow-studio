// Studio Flow — shared types, brand catalog, and workflow logic.
// This is the single source of truth for the redesigned photoshoot workflow.

export type ShootType = "panty" | "bra_panty" | "pushup" | "bra";
export type SlotKey = "model" | "bra" | "panty";
export type Pose = "front" | "side" | "back" | "mood" | "zoom" | "mockup";
export type DeckType = "deck_4" | "deck_5";
export type DeckShotKey = "side1" | "side2" | "mood" | "zoom" | "back";
export type RegenerateIssue = "pose" | "content" | "background";
export type EngineId = "pro" | "fast";
export type AspectId = "1:1" | "3:4" | "9:16" | "4:3" | "16:9" | "a4";

export interface Brand {
  id: string;
  name: string;
  headingsDisplay: string;
  bodyUi: string;
  /** foreground / font color */
  fg: string;
  /** backdrop / background color */
  bg: string;
  paletteNotes: string;
  overallLookFeel: string;
}

export interface ShootTypeMeta {
  id: ShootType;
  label: string;
  tint: string; // swatch accent (hex)
}

export interface ShotPresetContent {
  styleName: string;
  heading: string;
  subHeading: string;
  callouts: string[];
  calloutZones?: string[];
}

export interface GeneratedShot {
  id: string;
  /** Which Gear 2 bra deck this shot belongs to, if generated via the multi-bra batch workflow. */
  braId?: string;
  deckShot: DeckShotKey;
  aspect: AspectId;
  brandId: string;
  shootType: ShootType;
  pushupBraOnly: boolean;
  status: "queued" | "rendering" | "done" | "error";
  progress?: number;
  imageUrl?: string;
  error?: string;
  userNote?: string;
  note?: string;
  selected?: boolean;
  issues?: RegenerateIssue[];
  /** Style preset content used for this shot's overlay, if a style was selected. */
  presetContent?: ShotPresetContent;
}

// --- Catalog: the 11 innerwear brands (color chips are brand identity data) ---
export const BRANDS: Brand[] = [
  {
    id: "tweens",
    name: "Tweens",
    headingsDisplay: "Fraunces",
    bodyUi: "Inter",
    fg: "#6F4940",
    bg: "#F3F0E9",
    paletteNotes: "Cream beige base; warm nude softness; cocoa premium anchor",
    overallLookFeel: "Minimal premium daily comfort",
  },
  {
    id: "dressberry",
    name: "Dressberry",
    headingsDisplay: "Cormorant Garamond",
    bodyUi: "Manrope",
    fg: "#6B2E43",
    bg: "#F7F3EE",
    paletteNotes: "Soft ivory base; berry-plum anchor; muted sage accent",
    overallLookFeel: "Feminine fashion elegance",
  },
  {
    id: "invisi-soft",
    name: "Invisi-Soft",
    headingsDisplay: "Playfair Display",
    bodyUi: "Plus Jakarta Sans",
    fg: "#304C7A",
    bg: "#F6F8FB",
    paletteNotes: "Cool airy off-white; powder blue-grey base; deep blue anchor",
    overallLookFeel: "Invisible comfort luxury",
  },
  {
    id: "souminie",
    name: "Souminie",
    headingsDisplay: "Sora",
    bodyUi: "DM Sans",
    fg: "#2D4FA0",
    bg: "#F5FBFF",
    paletteNotes: "Fresh icy white; aqua-blue softness; rich cobalt anchor",
    overallLookFeel: "Clean modern lingerie premium",
  },
  {
    id: "komli",
    name: "Komli",
    headingsDisplay: "Cormorant Infant",
    bodyUi: "Mulish",
    fg: "#B62F57",
    bg: "#FBF4F6",
    paletteNotes: "Blush ivory base; rosy pink warmth; berry anchor",
    overallLookFeel: "Soft romantic sophistication",
  },
  {
    id: "joomie",
    name: "Joomie",
    headingsDisplay: "Allura",
    bodyUi: "Work Sans",
    fg: "#E21B2D",
    bg: "#FFF7F5",
    paletteNotes: "Warm ivory base; coral-nude softness; bold red anchor",
    overallLookFeel: "Playful premium confidence",
  },
  {
    id: "invisi-fit",
    name: "Invisi-fit",
    headingsDisplay: "Bodoni Moda",
    bodyUi: "Albert Sans",
    fg: "#7A631B",
    bg: "#FBF7EE",
    paletteNotes: "Champagne ivory base; sand nude; antique gold anchor",
    overallLookFeel: "Refined support-led luxury",
  },
  {
    id: "sztori",
    name: "Sztori",
    headingsDisplay: "Prata",
    bodyUi: "Outfit",
    fg: "#B2189B",
    bg: "#FFF4FB",
    paletteNotes: "Light pink base; vibrant magenta anchor; candy accent",
    overallLookFeel: "Bold premium storytelling",
  },
  {
    id: "intimist",
    name: "Intimist",
    headingsDisplay: "Italiana",
    bodyUi: "Onest",
    fg: "#7B34C9",
    bg: "#F8F4FA",
    paletteNotes: "Lilac ivory base; muted mauve softness; royal violet anchor",
    overallLookFeel: "Sensual calm elegance",
  },
  {
    id: "sushme",
    name: "Sushme",
    headingsDisplay: "Michroma",
    bodyUi: "Urbanist",
    fg: "#B81CB0",
    bg: "#FFF6FF",
    paletteNotes: "Soft pearl pink base; electric magenta anchor; plum accent",
    overallLookFeel: "Fashion-forward premium glam",
  },
  {
    id: "swanz",
    name: "Swanz",
    headingsDisplay: "Marcellus",
    bodyUi: "Libre Franklin",
    fg: "#5B2D28",
    bg: "#FAF7F3",
    paletteNotes: "Warm pearl base; dusty nude softness; cocoa-maroon anchor",
    overallLookFeel: "Classic premium grace",
  },
];

export const CUSTOM_BRANDS_STORAGE_KEY = "studioflow_custom_brands";

function slugifyBrandName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `brand-${Date.now()}`;
}

function isBrand(value: unknown): value is Brand {
  if (!value || typeof value !== "object") return false;
  const brand = value as Partial<Brand>;
  return Boolean(
    brand.id &&
      brand.name &&
      brand.headingsDisplay &&
      brand.bodyUi &&
      brand.fg &&
      brand.bg &&
      brand.overallLookFeel,
  );
}

export function buildCustomBrand(input: Omit<Brand, "id">): Brand {
  const baseId = `custom-${slugifyBrandName(input.name)}`;
  return {
    id: baseId,
    name: input.name.trim(),
    headingsDisplay: input.headingsDisplay.trim(),
    bodyUi: input.bodyUi.trim(),
    fg: input.fg.trim().toUpperCase(),
    bg: input.bg.trim().toUpperCase(),
    paletteNotes: input.paletteNotes.trim(),
    overallLookFeel: input.overallLookFeel.trim(),
  };
}

export function loadCustomBrands(): Brand[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_BRANDS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isBrand) : [];
  } catch {
    return [];
  }
}

export function saveCustomBrands(brands: Brand[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_BRANDS_STORAGE_KEY, JSON.stringify(brands));
}

export function getAvailableBrands(customBrands: Brand[] = []): Brand[] {
  return [...BRANDS, ...customBrands];
}

export const SHOOT_TYPES: ShootTypeMeta[] = [
  { id: "panty", label: "Panty", tint: "#f97316" },
  { id: "bra_panty", label: "Bra + Panty", tint: "#ec4899" },
  { id: "pushup", label: "Pushup", tint: "#8b5cf6" },
  { id: "bra", label: "Bra", tint: "#06b6d4" },
];

export const POSES: { id: Pose; label: string; hint: string }[] = [
  { id: "front", label: "Front", hint: "Hero facing shot" },
  { id: "side", label: "Side", hint: "Profile / fit" },
  { id: "back", label: "Back", hint: "Needs back photos" },
  { id: "mood", label: "Mood", hint: "Lifestyle framing" },
  { id: "zoom", label: "Zoom", hint: "Fabric detail" },
  { id: "mockup", label: "Mockup", hint: "Packshot / listing" },
];

export const DECKS: {
  id: DeckType;
  label: string;
  shortLabel: string;
  shots: DeckShotKey[];
  hint: string;
}[] = [
  {
    id: "deck_5",
    label: "5 Images Deck",
    shortLabel: "5 Deck",
    shots: ["side1", "side2", "mood", "zoom", "back"],
    hint: "Side 1 · Side 2 · Mood · Zoom · Back",
  },
  {
    id: "deck_4",
    label: "4 Images Deck",
    shortLabel: "4 Deck",
    shots: ["side1", "side2", "mood", "back"],
    hint: "Side 1 · Side 2 · Mood · Back",
  },
];

export const DECK_SHOT_LABELS: Record<DeckShotKey, string> = {
  side1: "Side 1",
  side2: "Side 2",
  mood: "Mood",
  zoom: "Zoom",
  back: "Back",
};

export const ASPECTS: { id: AspectId; label: string; ratio: string }[] = [
  { id: "1:1", label: "Square", ratio: "1 / 1" },
  { id: "3:4", label: "Portrait", ratio: "3 / 4" },
  { id: "9:16", label: "Story", ratio: "9 / 16" },
  { id: "4:3", label: "Landscape", ratio: "4 / 3" },
  { id: "16:9", label: "Cinema", ratio: "16 / 9" },
  { id: "a4", label: "Amazon A4+", ratio: "3 / 4" },
];

export const ENGINES: { id: EngineId; label: string; sub: string }[] = [
  { id: "pro", label: "Gemini 3 Pro", sub: "Best quality" },
  { id: "fast", label: "3.1 Fast", sub: "~12s / shot" },
];

export const REGENERATION_ISSUES: {
  id: RegenerateIssue;
  label: string;
  instruction: string;
}[] = [
  {
    id: "pose",
    label: "Pose",
    instruction: "Fix the pose while preserving the selected deck shot angle.",
  },
  {
    id: "content",
    label: "Content",
    instruction: "Fix product/content accuracy, garment shape, fit, color, and visible details.",
  },
  {
    id: "background",
    label: "Background",
    instruction: "Fix the background while preserving the selected brand color direction.",
  },
];

/** Which product slots the shoot type needs, in display order. */
export function requiredSlots(shootType: ShootType, pushupBraOnly: boolean): SlotKey[] {
  switch (shootType) {
    case "panty":
      return ["model", "panty"];
    case "bra":
      return ["model", "bra"];
    case "pushup":
      return pushupBraOnly ? ["model", "bra"] : ["model", "bra", "panty"];
    case "bra_panty":
    default:
      return ["model", "bra", "panty"];
  }
}

export function slotLabel(slot: SlotKey, shootType: ShootType): string {
  if (slot === "model") return "Model";
  if (slot === "panty") return "Panty";
  return shootType === "pushup" ? "Pushup Bra" : "Bra";
}

/** Poses valid for a shoot type. Panty excludes fabric Zoom + packshot Mockup. */
export function allowedPoses(shootType: ShootType): Pose[] {
  const all: Pose[] = ["front", "side", "back", "mood", "zoom", "mockup"];
  if (shootType === "panty") return ["front", "side", "back", "mood"];
  return all;
}

/** Smart default pose set — the catalog essentials, minus optional extras. */
export function defaultPoses(shootType: ShootType): Pose[] {
  return allowedPoses(shootType).filter((p) => p !== "zoom" && p !== "mockup");
}

export function brandLocked(shootType: ShootType): boolean {
  return false;
}

export function getBrand(id: string | null, customBrands: Brand[] = []): Brand {
  return getAvailableBrands(customBrands).find((b) => b.id === id) ?? BRANDS[0];
}

export function allowedDecks(shootType: ShootType): DeckType[] {
  return shootType === "panty" ? ["deck_4"] : ["deck_4", "deck_5"];
}

export function getDeck(deck: DeckType) {
  return DECKS.find((d) => d.id === deck) ?? DECKS[0];
}

export function deckShotToPose(shot: DeckShotKey): Pose {
  if (shot === "side1" || shot === "side2") return "side";
  return shot;
}

export function defaultDeck(shootType: ShootType): DeckType {
  return shootType === "panty" ? "deck_4" : "deck_5";
}

export function buildBrandLock(brand: Brand): string {
  return [
    "BRAND DIRECTION LOCK:",
    `Brand: ${brand.name}`,
    `Headings/display font: ${brand.headingsDisplay}.`,
    `Sub-heading and callout font: ${brand.bodyUi}.`,
    `Text and callout color: ${brand.fg}.`,
    `Studio background color: ${brand.bg}.`,
    `Palette notes: ${brand.paletteNotes}.`,
    `Overall look and feel: ${brand.overallLookFeel}.`,
    "Keep this brand styling consistent across the full generated deck.",
  ].join("\n");
}

export function buildRegenerationNote(issues: RegenerateIssue[]): string {
  const instructions =
    issues.length > 0
      ? issues
          .map((issue) => REGENERATION_ISSUES.find((item) => item.id === issue)?.instruction)
          .filter(Boolean)
      : ["Improve the selected image while preserving all correct deck and brand details."];

  return [
    "Regenerate only this selected deck image.",
    ...instructions,
    "Keep the same brand styling, product identity, model identity, and approved deck consistency.",
  ].join(" ");
}

export function shootTint(shootType: ShootType): string {
  return SHOOT_TYPES.find((s) => s.id === shootType)?.tint ?? "#f97316";
}

export function shootTypeLabel(shootType: ShootType, pushupBraOnly: boolean): string {
  if (shootType === "pushup" && pushupBraOnly) return "Pushup (bra-only)";
  return SHOOT_TYPES.find((s) => s.id === shootType)?.label ?? "Shoot";
}
