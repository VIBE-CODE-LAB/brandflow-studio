// Gear 2 — multi-bra batch workflow: one Model(+Panty) upload, up to MAX_BRA_IMAGES bra photos,
// each producing its own full deck-size set of GeneratedShots.

import { type AspectId, type Brand, type DeckType, type GeneratedShot, type ShootType, getDeck } from "@/lib/studio";

export const MAX_BRA_IMAGES = 12;

export type BraDeckStatus = "queued" | "rendering" | "done" | "error";

export interface BraDeck {
  id: string;
  braImage: string;
  shots: GeneratedShot[];
}

export function braDeckStatus(deck: BraDeck): BraDeckStatus {
  if (deck.shots.some((s) => s.status === "error")) return "error";
  if (deck.shots.every((s) => s.status === "done")) return "done";
  if (deck.shots.some((s) => s.status === "rendering" || s.status === "done")) return "rendering";
  return "queued";
}

export function braDeckProgress(deck: BraDeck): number {
  if (deck.shots.length === 0) return 0;
  const total = deck.shots.reduce((sum, s) => sum + (s.status === "done" ? 100 : (s.progress ?? 0)), 0);
  return Math.round(total / deck.shots.length);
}

let braShotCounter = 0;
const nextBraShotId = () => `bra-shot-${Date.now()}-${braShotCounter++}`;
let braDeckCounter = 0;
const nextBraDeckId = () => `bra-deck-${Date.now()}-${braDeckCounter++}`;

interface BuildBraDecksOptions {
  braImages: string[];
  deckType: DeckType;
  aspect: AspectId;
  brand: Brand;
  shootType: ShootType;
  pushupBraOnly: boolean;
  note: string;
}

export function buildBraDecks({
  braImages,
  deckType,
  aspect,
  brand,
  shootType,
  pushupBraOnly,
  note,
}: BuildBraDecksOptions): BraDeck[] {
  const deckShots = getDeck(deckType).shots;

  return braImages.map((braImage) => {
    const deckId = nextBraDeckId();
    return {
      id: deckId,
      braImage,
      shots: deckShots.map((deckShot) => ({
        id: nextBraShotId(),
        braId: deckId,
        deckShot,
        aspect,
        brandId: brand.id,
        shootType,
        pushupBraOnly,
        status: "queued" as const,
        progress: 0,
        userNote: note,
      })),
    };
  });
}
