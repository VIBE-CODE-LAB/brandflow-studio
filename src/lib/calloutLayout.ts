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
  | "right_lower"
  // Zoom shots use a distinct split composition — photo on the LEFT ~60-65%, a flat
  // brand-color text panel on the RIGHT ~35-40% — so these sit inside that panel only.
  | "panel_headline"
  | "panel_upper"
  | "panel_middle"
  | "panel_lower";

export interface CalloutAnchor {
  x: number;
  y: number;
  align: "left" | "right";
  maxWidthFraction?: number;
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
  panel_headline: { x: 0.965, y: 0.08, align: "right", maxWidthFraction: 0.3 },
  panel_upper: { x: 0.965, y: 0.4, align: "right", maxWidthFraction: 0.28 },
  panel_middle: { x: 0.965, y: 0.6, align: "right", maxWidthFraction: 0.28 },
  panel_lower: { x: 0.965, y: 0.8, align: "right", maxWidthFraction: 0.28 },
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
    zoom: { headline: "panel_headline", callouts: ["panel_upper", "panel_middle", "panel_lower"] },
  },
  // Pushup-Bra-Only-Prompt.txt: same shape as bra, side1 order left/bottom-left/right.
  pushup_bra_only: {
    side1: { headline: "top_left", callouts: ["left_middle", "bottom_left", "right_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
    zoom: { headline: "panel_headline", callouts: ["panel_upper", "panel_middle", "panel_lower"] },
  },
  // Pushup-Set.txt: side1 order right/bottom-left/left (reversed from bra-only).
  pushup_set: {
    side1: { headline: "top_left", callouts: ["right_middle", "bottom_left", "left_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
    zoom: { headline: "panel_headline", callouts: ["panel_upper", "panel_middle", "panel_lower"] },
  },
  // Bra-panty-Prompt.txt: matches Pushup-Set's side1 order (right/bottom-left/left).
  bra_panty: {
    side1: { headline: "top_left", callouts: ["right_middle", "bottom_left", "left_middle"] },
    side2: { headline: "top_left", callouts: ["left_upper", "left_middle", "left_lower"] },
    back: { headline: "top_left", callouts: ["right_upper", "right_middle", "right_lower"] },
    mood: { headline: "top_left", callouts: ["left_upper", "left_lower", "right_upper", "right_lower"] },
    zoom: { headline: "panel_headline", callouts: ["panel_upper", "panel_middle", "panel_lower"] },
  },
  // The PANTY ONLY sections in Bra-panty-Prompt.txt define no infographic/callout
  // layout of their own (they're plain fit-shot templates) — reuse the sibling
  // Bra+Panty layout from the same file as the closest faithful match. Panty decks
  // never include a zoom shot, so no zoom entry is needed here.
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

/** Null when this mode has no defined infographic layout for the shot (e.g. Panty's zoom, which isn't part of its deck). */
export function getCalloutLayout(
  shootType: ShootType,
  pushupBraOnly: boolean,
  deckShot: DeckShotKey,
): DeckShotCalloutLayout | null {
  return LAYOUTS[promptSourceId(shootType, pushupBraOnly)][deckShot] ?? null;
}

function isPanelAnchor(id: AnchorId): boolean {
  return id.startsWith("panel_");
}

/**
 * Builds an explicit "x=N% to M%" geometry lock, in the same style and rigor as the
 * one hard-coded example in the source prompts (Pushup-Bra-Only Side 2's "SIDE 2 CANVAS
 * GEOMETRY LOCK"), generated from this layout's actual anchor positions so the model is
 * scaled/positioned to leave exactly the space the overlay will draw into — for every
 * mode, not just the one that happened to spell it out.
 */
export function buildGeometryLock(layout: DeckShotCalloutLayout): string {
  const allAnchorIds = [layout.headline, ...layout.callouts];

  if (allAnchorIds.some(isPanelAnchor)) {
    return [
      "CANVAS GEOMETRY LOCK — FINAL, EXACT, NON-NEGOTIABLE:",
      "Keep the LEFT ~60-65% of the frame as the product/model photo zone, and the RIGHT ~35-40% as a completely flat, seamless panel in the exact brand background color — no gradient, no texture, no props.",
      "The right panel must stay perfectly empty (flat color only) top to bottom — the model, product, hands, or any shadow must never cross into it.",
    ].join("\n");
  }

  const hasLeft = allAnchorIds.some((id) => ANCHORS[id].align === "left");
  const hasRight = allAnchorIds.some((id) => ANCHORS[id].align === "right");

  const lines = ["CANVAS GEOMETRY LOCK — FINAL, EXACT, NON-NEGOTIABLE:"];
  lines.push(
    "TOP MARGIN: scale and position the model so there is completely clean, empty background across the FULL WIDTH of the frame from the very top edge down to at least x-height 14% of the frame — no hair, head, or shoulder may enter that top strip. The headline sits in this margin.",
  );

  if (hasLeft && hasRight) {
    lines.push(
      "Scale the model down and center her narrowly: the entire visible model/product silhouette (including hair and arms) must stay inside x=32% to x=68% of the frame width.",
      "Reserve x=0% to x=30% on the LEFT and x=70% to x=100% on the RIGHT as completely clean, empty brand-colored background — no skin, hair, or product may enter either zone. Callout text goes in these two zones.",
    );
  } else if (hasLeft) {
    lines.push(
      "Position and scale the model toward the RIGHT: the entire visible model/product silhouette (including hair and arms) must stay inside x=38% to x=92% of the frame width.",
      "Reserve x=0% to x=36% on the LEFT as completely clean, empty brand-colored background — no skin, hair, or product may enter it. The headline and callout text column goes here.",
    );
  } else if (hasRight) {
    lines.push(
      "Position and scale the model toward the LEFT: the entire visible model/product silhouette (including hair and arms) must stay inside x=8% to x=62% of the frame width.",
      "Reserve x=64% to x=100% on the RIGHT as completely clean, empty brand-colored background — no skin, hair, or product may enter it. The callout text column goes here (headline still sits top-left in the model's own margin).",
    );
  }

  lines.push(
    "Do NOT use a tight close-up crop to fill these reserved zones with more of the model — shrink/scale the model down instead, keeping the full product visible.",
  );

  return lines.join("\n");
}
