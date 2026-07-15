// Where the headline/sub-heading/callouts sit on each deck shot, taken directly from
// that mode's own "OVERALL COMPOSITION BALANCE" section in the prompt .txt files —
// not invented. Positions are canvas-relative anchors, not garment-tracking: the source
// prompts describe screen regions ("LEFT, vertically middle zone", "BOTTOM LEFT", "RIGHT
// side stacked"), not exact pixel coordinates, and Gemini's framing isn't pixel-consistent
// shot to shot, so anchors are the faithful level of precision available.
import type { DeckShotKey, ShootType } from "@/lib/studio";

export type AnchorId =
  | "top_left"
  | "left_upper"
  | "left_middle"
  | "left_lower"
  | "bottom_left"
  | "right_upper"
  | "right_middle"
  | "right_lower";

export interface CalloutAnchor {
  x: number;
  y: number;
  align: "left" | "right";
}

export const ANCHORS: Record<AnchorId, CalloutAnchor> = {
  top_left: { x: 0.055, y: 0.07, align: "left" },
  left_upper: { x: 0.055, y: 0.3, align: "left" },
  left_middle: { x: 0.055, y: 0.5, align: "left" },
  left_lower: { x: 0.055, y: 0.68, align: "left" },
  bottom_left: { x: 0.055, y: 0.87, align: "left" },
  right_upper: { x: 0.945, y: 0.3, align: "right" },
  right_middle: { x: 0.945, y: 0.5, align: "right" },
  right_lower: { x: 0.945, y: 0.68, align: "right" },
};

export interface DeckShotCalloutLayout {
  headline: AnchorId;
  callouts: AnchorId[];
}

type PromptSourceId = "bra" | "bra_panty" | "panty" | "pushup_bra_only" | "pushup_set";

const LAYOUTS: Record<PromptSourceId, Partial<Record<DeckShotKey, DeckShotCalloutLayout>>> = {
  // Bra-prompt.txt: side1 left_middle/bottom_left/right_middle, side2 left stack,
  // back right stack, mood 2 left + 2 right.
  bra: {
    side1: { headline: "top_left", callouts: ["left_middle", "bottom_left", "right_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
  },
  // Pushup-Bra-Only-Prompt.txt: same shape as bra, side1 order left/bottom-left/right.
  pushup_bra_only: {
    side1: { headline: "top_left", callouts: ["left_middle", "bottom_left", "right_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
  },
  // Pushup-Set.txt: side1 order right/bottom-left/left (reversed from bra-only).
  pushup_set: {
    side1: { headline: "top_left", callouts: ["right_middle", "bottom_left", "left_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
  },
  // Bra-panty-Prompt.txt: matches Pushup-Set's side1 order (right/bottom-left/left).
  bra_panty: {
    side1: { headline: "top_left", callouts: ["right_middle", "bottom_left", "left_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
  },
  // The PANTY ONLY sections in Bra-panty-Prompt.txt define no infographic/callout
  // layout of their own (they're plain fit-shot templates) — reuse the sibling
  // Bra+Panty layout from the same file as the closest faithful match.
  panty: {
    side1: { headline: "top_left", callouts: ["right_middle", "bottom_left", "left_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
  },
};

function promptSourceId(shootType: ShootType, pushupBraOnly: boolean): PromptSourceId {
  if (shootType === "bra") return "bra";
  if (shootType === "pushup") return pushupBraOnly ? "pushup_bra_only" : "pushup_set";
  if (shootType === "panty") return "panty";
  return "bra_panty";
}

/** Null for deck shots with no defined infographic layout (zoom, mockup). */
export function getCalloutLayout(
  shootType: ShootType,
  pushupBraOnly: boolean,
  deckShot: DeckShotKey,
): DeckShotCalloutLayout | null {
  return LAYOUTS[promptSourceId(shootType, pushupBraOnly)][deckShot] ?? null;
}
