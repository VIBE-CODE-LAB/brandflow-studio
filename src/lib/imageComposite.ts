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

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  scrimColor?: string;
  lineHeight: number;
  align: "left" | "right";
  maxWidthFraction?: number;
}

interface WrappedLine {
  text: string;
  font: string;
  width: number;
}

/** Draws (optionally multi-line, word-wrapped) text anchored at a fractional canvas position,
 *  with a soft rounded scrim behind it so it stays legible over any photo content. */
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchor: { x: number; y: number },
  opts: TextBlockOptions,
): number {
  const canvas = ctx.canvas;
  const maxWidth = (opts.maxWidthFraction ?? 0.4) * canvas.width;
  const x = anchor.x * canvas.width;
  let y = anchor.y * canvas.height;

  const wrapped: WrappedLine[] = [];
  text
    .split("\n")
    .filter(Boolean)
    .forEach((rawLine, lineIndex) => {
      const font = lineIndex > 0 && opts.secondLineFont ? opts.secondLineFont : opts.font;
      ctx.font = font;
      for (const line of wrapLine(ctx, rawLine, maxWidth)) {
        wrapped.push({ text: line, font, width: ctx.measureText(line).width });
      }
    });

  if (wrapped.length === 0) return y;

  if (opts.scrimColor) {
    const pad = opts.lineHeight * 0.35;
    const blockWidth = Math.max(...wrapped.map((l) => l.width)) + pad * 2;
    const blockHeight = wrapped.length * opts.lineHeight + pad * 1.2;
    const rectX = opts.align === "right" ? x - blockWidth + pad : x - pad;
    ctx.fillStyle = opts.scrimColor;
    ctx.beginPath();
    const radius = Math.min(pad, 14);
    ctx.roundRect?.(rectX, y - pad * 0.6, blockWidth, blockHeight, radius);
    if (!ctx.roundRect) ctx.rect(rectX, y - pad * 0.6, blockWidth, blockHeight);
    ctx.fill();
  }

  ctx.textAlign = opts.align;
  ctx.textBaseline = "top";
  ctx.fillStyle = opts.color;
  for (const line of wrapped) {
    ctx.font = line.font;
    ctx.fillText(line.text, x, y);
    y += opts.lineHeight;
  }

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
  const dotRadius = Math.max(4, Math.round(canvas.width * 0.005));
  const cx = anchor.x * canvas.width;
  const cy = anchor.y * canvas.height;

  const gap = dotRadius * 3.5;
  const textAnchorX = (anchor.align === "left" ? cx + gap : cx - gap) / canvas.width;
  const [feature, benefit] = text.split(/\s*\/\s*/).filter(Boolean);

  ctx.beginPath();
  ctx.fillStyle = brand.fg;
  ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  drawTextBlock(
    ctx,
    benefit ? `${feature}\n${benefit}` : (feature ?? text),
    { x: textAnchorX, y: (cy - calloutFontSize * 0.6) / canvas.height },
    {
      font: `700 ${calloutFontSize}px "${brand.headingsDisplay}"`,
      secondLineFont: `500 ${Math.round(calloutFontSize * 0.92)}px "${brand.bodyUi}"`,
      color: brand.fg,
      scrimColor: hexToRgba(brand.bg, 0.86),
      lineHeight: calloutFontSize * 1.32,
      align: anchor.align,
      maxWidthFraction: anchor.maxWidthFraction ?? 0.34,
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

  const headlineSize = Math.round(canvas.width * 0.05);
  const subHeadSize = Math.round(canvas.width * 0.028);
  const calloutSize = Math.round(canvas.width * 0.027);
  const scrim = hexToRgba(brand.bg, 0.86);

  const headAnchor = ANCHORS[layout.headline];
  const afterHeadline = drawTextBlock(ctx, content.heading, headAnchor, {
    font: `700 ${headlineSize}px "${brand.headingsDisplay}"`,
    color: brand.fg,
    scrimColor: scrim,
    lineHeight: headlineSize * 1.18,
    align: headAnchor.align,
    maxWidthFraction: headAnchor.maxWidthFraction ?? 0.42,
  });

  if (content.subHead) {
    drawTextBlock(
      ctx,
      content.subHead,
      { x: headAnchor.x, y: (afterHeadline + headlineSize * 0.3) / canvas.height },
      {
        font: `500 ${subHeadSize}px "${brand.bodyUi}"`,
        color: brand.fg,
        scrimColor: scrim,
        lineHeight: subHeadSize * 1.35,
        align: headAnchor.align,
        maxWidthFraction: headAnchor.maxWidthFraction ?? 0.42,
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
