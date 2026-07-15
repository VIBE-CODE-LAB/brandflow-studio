// Draws the preset's heading/sub-heading/callouts on top of a clean Gemini photo,
// client-side, in the exact selected brand's font and hex colors — reliable, since it
// doesn't depend on Gemini rendering precise typography into the pixels itself.
import type { Brand } from "@/lib/studio";
import { ANCHORS, type CalloutAnchor, type DeckShotCalloutLayout } from "@/lib/calloutLayout";
import { ensureGoogleFontsLoaded } from "@/lib/fontLoader";

export interface CalloutOverlayContent {
  heading: string;
  subHead: string;
  callouts: string[];
}

const OUTPUT_QUALITY = 0.92;

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the generated image for overlay compositing."));
    img.src = src;
  });
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface TextBlockOptions {
  font: string;
  secondLineFont?: string;
  color: string;
  lineHeight: number;
  align: "left" | "right";
  maxWidthFraction?: number;
}

/** Draws (optionally multi-line, word-wrapped) text anchored at a fractional canvas position. */
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: { x: number; y: number },
  opts: TextBlockOptions,
): number {
  const canvas = ctx.canvas;
  const maxWidth = (opts.maxWidthFraction ?? 0.4) * canvas.width;
  ctx.textAlign = opts.align;
  ctx.textBaseline = "top";
  ctx.fillStyle = opts.color;

  const x = anchor.x * canvas.width;
  let y = anchor.y * canvas.height;

  text
    .split("\n")
    .filter(Boolean)
    .forEach((rawLine, lineIndex) => {
      ctx.font = lineIndex > 0 && opts.secondLineFont ? opts.secondLineFont : opts.font;
      for (const wrapped of wrapLine(ctx, rawLine, maxWidth)) {
        ctx.fillText(wrapped, x, y);
        y += opts.lineHeight;
      }
    });

  return y;
}

function drawCallout(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: CalloutAnchor,
  brand: Brand,
  calloutFontSize: number,
) {
  const canvas = ctx.canvas;
  const dotRadius = Math.max(3, Math.round(canvas.width * 0.0035));
  const cx = anchor.x * canvas.width;
  const cy = anchor.y * canvas.height;

  ctx.beginPath();
  ctx.fillStyle = brand.fg;
  ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  const gap = dotRadius * 3.5;
  const textAnchorX = (anchor.align === "left" ? cx + gap : cx - gap) / canvas.width;
  const [feature, benefit] = text.split(/\s*\/\s*/).filter(Boolean);

  drawTextBlock(
    ctx,
    benefit ? `${feature}\n${benefit}` : feature ?? text,
    { x: textAnchorX, y: (cy - calloutFontSize * 0.6) / canvas.height },
    {
      font: `600 ${calloutFontSize}px "${brand.headingsDisplay}"`,
      secondLineFont: `400 ${calloutFontSize}px "${brand.bodyUi}"`,
      color: brand.fg,
      lineHeight: calloutFontSize * 1.3,
      align: anchor.align,
      maxWidthFraction: 0.3,
    },
  );
}

/**
 * Composites heading/sub-heading/callouts onto a clean generated photo.
 * Returns a new blob: URL for the finished image; the input imageUrl is left untouched.
 */
export async function compositeCalloutOverlay(
  imageUrl: string,
  brand: Brand,
  layout: DeckShotCalloutLayout,
  content: CalloutOverlayContent,
): Promise<string> {
  await ensureGoogleFontsLoaded([brand.headingsDisplay, brand.bodyUi]);

  const image = await loadImageEl(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return imageUrl;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const headlineSize = Math.round(canvas.width * 0.042);
  const subHeadSize = Math.round(canvas.width * 0.023);
  const calloutSize = Math.round(canvas.width * 0.019);

  const headAnchor = ANCHORS[layout.headline];
  const afterHeadline = drawTextBlock(
    ctx,
    content.heading,
    headAnchor,
    {
      font: `700 ${headlineSize}px "${brand.headingsDisplay}"`,
      color: brand.fg,
      lineHeight: headlineSize * 1.15,
      align: headAnchor.align,
      maxWidthFraction: 0.42,
    },
  );

  if (content.subHead) {
    drawTextBlock(
      ctx,
      content.subHead,
      { x: headAnchor.x, y: (afterHeadline + headlineSize * 0.25) / canvas.height },
      {
        font: `500 ${subHeadSize}px "${brand.bodyUi}"`,
        color: brand.fg,
        lineHeight: subHeadSize * 1.3,
        align: headAnchor.align,
        maxWidthFraction: 0.42,
      },
    );
  }

  layout.callouts.forEach((anchorId, index) => {
    const text = content.callouts[index];
    if (!text?.trim()) return;
    drawCallout(ctx, text.trim(), ANCHORS[anchorId], brand, calloutSize);
  });

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : imageUrl), "image/jpeg", OUTPUT_QUALITY);
  });
}
