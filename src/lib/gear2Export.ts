// Bulk-export every finished bra deck as one zip, organized into a folder per bra
// named after that bra photo's dominant color.

import { createZip } from "@/lib/zip";
import { DECK_SHOT_LABELS } from "@/lib/studio";
import { getDominantColorName } from "@/lib/colorName";
import type { BraDeck } from "@/lib/gear2";

async function shotBytes(imageUrl: string): Promise<{ bytes: Uint8Array; ext: string }> {
  const blob = await fetch(imageUrl).then((response) => response.blob());
  const ext = blob.type === "image/jpeg" ? "jpg" : "png";
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext };
}

export async function downloadAllDecksZip(braDecks: BraDeck[]): Promise<void> {
  const usedNames = new Map<string, number>();
  const files: { name: string; bytes: Uint8Array }[] = [];

  for (const deck of braDecks) {
    const doneShots = deck.shots.filter((s) => s.status === "done" && s.imageUrl);
    if (doneShots.length === 0) continue;

    const baseName = await getDominantColorName(deck.braImage);
    const seen = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, seen + 1);
    const folderName = seen === 0 ? baseName : `${baseName}-${seen + 1}`;

    for (const [index, shot] of doneShots.entries()) {
      const { bytes, ext } = await shotBytes(shot.imageUrl as string);
      const label = DECK_SHOT_LABELS[shot.deckShot].toLowerCase().replace(/\s+/g, "-");
      files.push({ name: `${folderName}/${String(index + 1).padStart(2, "0")}-${label}.${ext}`, bytes });
    }
  }

  if (files.length === 0) return;

  const zip = createZip(files);
  const link = document.createElement("a");
  link.download = `gear2-bra-decks-${files.length}-images.zip`;
  link.href = URL.createObjectURL(zip);
  link.click();
  URL.revokeObjectURL(link.href);
}
