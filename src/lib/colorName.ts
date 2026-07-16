// Samples a bra photo's dominant color and maps it to the closest named color,
// so bulk-exported decks can be organized into human-readable folders.

interface NamedColor {
  name: string;
  r: number;
  g: number;
  b: number;
}

const PALETTE: NamedColor[] = [
  { name: "Black", r: 24, g: 24, b: 26 },
  { name: "Charcoal", r: 58, g: 58, b: 62 },
  { name: "Grey", r: 140, g: 140, b: 142 },
  { name: "White", r: 245, g: 245, b: 245 },
  { name: "Ivory", r: 240, g: 234, b: 214 },
  { name: "Beige", r: 222, g: 202, b: 173 },
  { name: "Nude", r: 224, g: 172, b: 142 },
  { name: "Tan", r: 189, g: 145, b: 105 },
  { name: "Brown", r: 101, g: 67, b: 33 },
  { name: "Maroon", r: 128, g: 32, b: 40 },
  { name: "Red", r: 200, g: 30, b: 40 },
  { name: "Coral", r: 240, g: 128, b: 105 },
  { name: "Pink", r: 240, g: 170, b: 190 },
  { name: "Hot Pink", r: 231, g: 84, b: 128 },
  { name: "Rose", r: 200, g: 110, b: 130 },
  { name: "Magenta", r: 200, g: 30, b: 160 },
  { name: "Purple", r: 128, g: 60, b: 170 },
  { name: "Lavender", r: 180, g: 160, b: 210 },
  { name: "Navy", r: 30, g: 40, b: 90 },
  { name: "Blue", r: 50, g: 100, b: 200 },
  { name: "Teal", r: 30, g: 130, b: 130 },
  { name: "Mint", r: 150, g: 220, b: 190 },
  { name: "Green", r: 60, g: 140, b: 80 },
  { name: "Olive", r: 110, g: 110, b: 60 },
  { name: "Mustard", r: 200, g: 165, b: 45 },
  { name: "Yellow", r: 230, g: 210, b: 60 },
  { name: "Orange", r: 220, g: 120, b: 40 },
  { name: "Champagne", r: 235, g: 220, b: 190 },
  { name: "Gold", r: 200, g: 165, b: 90 },
];

function nearestColorName(r: number, g: number, b: number): string {
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const c of PALETTE) {
    const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.name;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Downsamples the image and averages its pixels to the nearest named color. Falls back to "Bra" on failure. */
export async function getDominantColorName(dataUrl: string): Promise<string> {
  try {
    const image = await loadImage(dataUrl);
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "Bra";

    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    if (n === 0) return "Bra";

    return nearestColorName(r / n, g / n, b / n);
  } catch {
    return "Bra";
  }
}
