// Studio Flow — shared types, brand catalog, and workflow logic.
// This is the single source of truth for the redesigned photoshoot workflow.

export type ShootType = "panty" | "bra_panty" | "pushup" | "bra";
export type SlotKey = "model" | "bra" | "panty";
export type Pose = "front" | "side" | "back" | "mood" | "zoom" | "mockup";
export type EngineId = "pro" | "fast";
export type AspectId = "1:1" | "3:4" | "9:16" | "4:3" | "16:9" | "a4";

export interface Brand {
  id: string;
  name: string;
  /** foreground / logo color */
  fg: string;
  /** backdrop / fabric color */
  bg: string;
}

export interface ShootTypeMeta {
  id: ShootType;
  label: string;
  tint: string; // swatch accent (hex)
}

export interface GeneratedShot {
  id: string;
  pose: Pose;
  aspect: AspectId;
  brandId: string | null;
  shootType: ShootType;
  status: "queued" | "rendering" | "done";
  note?: string;
}

// --- Catalog: the 11 innerwear brands (color chips are brand identity data) ---
export const BRANDS: Brand[] = [
  { id: "tweens", name: "Tweens", fg: "#d6336c", bg: "#ffe3ec" },
  { id: "dressberry", name: "Dressberry", fg: "#7a1f4b", bg: "#f7d9e6" },
  { id: "invisi-soft", name: "Invisi-Soft", fg: "#8a6d5b", bg: "#f2e6da" },
  { id: "souminie", name: "Souminie", fg: "#0f766e", bg: "#d5f2ec" },
  { id: "komli", name: "Komli", fg: "#c2410c", bg: "#ffe6d5" },
  { id: "joomie", name: "Joomie", fg: "#be123c", bg: "#ffe0e6" },
  { id: "invisi-fit", name: "Invisi-fit", fg: "#475569", bg: "#e6ebf2" },
  { id: "sztori", name: "Sztori", fg: "#6d28d9", bg: "#ece3ff" },
  { id: "intimist", name: "Intimist", fg: "#86198f", bg: "#f6ddf5" },
  { id: "sushme", name: "Sushme", fg: "#db2777", bg: "#ffdcee" },
  { id: "swanz", name: "Swanz", fg: "#1e3a8a", bg: "#dbe4ff" },
];

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
  return shootType === "panty";
}

export function shootTint(shootType: ShootType): string {
  return SHOOT_TYPES.find((s) => s.id === shootType)?.tint ?? "#f97316";
}

export function shootTypeLabel(shootType: ShootType, pushupBraOnly: boolean): string {
  if (shootType === "pushup" && pushupBraOnly) return "Pushup (bra-only)";
  return SHOOT_TYPES.find((s) => s.id === shootType)?.label ?? "Shoot";
}
