import { type AspectId, type DeckShotKey, type EngineId, type SlotKey, type ShootType, requiredSlots, slotLabel } from "@/lib/studio";
import type { ImageMap } from "@/components/studio/UploadTray";

interface GenerateImageOptions {
  apiKey: string;
  prompt: string;
  images: ImageMap;
  shootType: ShootType;
  pushupBraOnly: boolean;
  deckShot: DeckShotKey;
  engine: EngineId;
  aspect: AspectId;
}

function geminiAspectRatio(aspect: AspectId): string {
  return aspect === "a4" ? "3:4" : aspect;
}

interface InlineImage {
  label: string;
  mimeType: string;
  data: string;
}

const OUTPUT_QUALITY = 0.99;

function targetOutputSize(aspect: AspectId): { width: number; height: number } {
  switch (aspect) {
    case "1:1":
      return { width: 2048, height: 2048 };
    case "9:16":
      return { width: 1350, height: 2400 };
    case "4:3":
      return { width: 2400, height: 1792 };
    case "16:9":
      return { width: 2400, height: 1350 };
    case "a4":
    case "3:4":
    default:
      return { width: 1792, height: 2400 };
  }
}

function outputSizeInstruction(aspect: AspectId): string {
  const { width, height } = targetOutputSize(aspect);
  return `Final export target: strict 2K ${width}x${height}px.`;
}

function dataUrlToInline(label: string, value: string | undefined): InlineImage | null {
  if (!value) return null;
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(value);
  if (!match) return null;

  return {
    label,
    mimeType: match[1],
    data: match[2],
  };
}

function referenceImages({
  images,
  shootType,
  pushupBraOnly,
  deckShot,
}: Pick<GenerateImageOptions, "images" | "shootType" | "pushupBraOnly" | "deckShot">): InlineImage[] {
  const slots = requiredSlots(shootType, pushupBraOnly);
  const refs: InlineImage[] = [];

  for (const slot of slots) {
    const label = slotLabel(slot as SlotKey, shootType);
    const normal = dataUrlToInline(label, images[slot]);
    if (normal) refs.push(normal);

    if (deckShot === "back") {
      const back = dataUrlToInline(`${label} back view`, images[`${slot}Back`]);
      if (back) refs.push(back);
    }
  }

  return refs;
}

function modelCandidates(engine: EngineId): string[] {
  return engine === "pro" ? ["gemini-3-pro-image-preview"] : ["gemini-3.1-flash-image-preview"];
}

function pushupGenerationLock(options: GenerateImageOptions): string {
  if (options.shootType !== "pushup") return "";
  if (options.deckShot !== "side1" && options.deckShot !== "side2" && options.deckShot !== "mood") {
    return "";
  }

  const poseLabel =
    options.deckShot === "side1"
      ? "Side 1"
      : options.deckShot === "side2"
        ? "Side 2"
        : "Mood";

  return [
    "FINAL GEMINI GENERATION LOCK — PUSHUP LEVEL 3 EFFECT:",
    `This request is Pushup ${options.pushupBraOnly ? "Bra-Only" : "Set"} mode, ${poseLabel} pose.`,
    "Before rendering pixels, verify the bra reads as a Level 3 push-up bra, not a light-padding comfort bra.",
    "Both cups must show strong padded volume, upward lift from the under-cup, inward center push, rounded upper-cup fullness, visible fuller shape, and forward three-dimensional projection.",
    "The result is wrong if the cups look flat, shallow, lightly padded, minimizer-like, sports-bra-like, or only gently lifted.",
    "If any heading, sub-heading, or style-preset text says light padding, gentle lift, second skin, or easy support, ignore that weak meaning and render visible Level 3 push-up shaping instead.",
    options.pushupBraOnly && options.deckShot === "side2"
      ? [
          "BRA-ONLY SIDE 2 SPECIFIC OVERRIDE:",
          "This front-facing bra-only image must not copy a flat uploaded bra silhouette. Preserve the garment color, fabric, seams, straps, trim, and band, but visibly reshape the worn cups into Level 3 push-up volume.",
          "Make the effect stronger and easier to see than full-set Side 2 because there is no panty and the bra is larger in frame: lifted under-cup curve, rounded upper-cup fullness, inward center push, modest natural center cleavage/shaping, and forward cup projection.",
          "A normal molded bra, T-shirt bra, shallow cup, minimizer, or gentle support result is a failed render.",
        ].join("\n")
      : "",
    "Keep the effect natural, symmetric, modest, and ecommerce-catalog appropriate while making the Level 3 push-up lift clearly visible.",
  ].filter(Boolean).join("\n");
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Generated image could not be loaded for export."));
    };
    image.src = objectUrl;
  });
}

async function normalizeGeneratedImage(blob: Blob, aspect: AspectId): Promise<Blob> {
  const image = await loadBlobImage(blob);
  const { width, height } = targetOutputSize(aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return blob;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "contrast(1.05) saturate(1.03)";
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = "none";

  const imageData = ctx.getImageData(0, 0, width, height);
  const source = imageData.data;
  const sharpened = new Uint8ClampedArray(source);
  const mix = 0.18;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const center = source[index + channel] * 5;
        const neighbors =
          source[index - 4 + channel] +
          source[index + 4 + channel] +
          source[index - width * 4 + channel] +
          source[index + width * 4 + channel];
        const sharp = Math.max(0, Math.min(255, center - neighbors));
        sharpened[index + channel] = source[index + channel] * (1 - mix) + sharp * mix;
      }
    }
  }
  imageData.data.set(sharpened);
  ctx.putImageData(imageData, 0, 0);

  return await new Promise((resolve) => {
    canvas.toBlob((exportBlob) => resolve(exportBlob ?? blob), "image/png", OUTPUT_QUALITY);
  });
}

async function extractImageUrl(response: unknown, aspect: AspectId): Promise<string | null> {
  const data = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
          inline_data?: { mime_type?: string; data?: string };
        }>;
      };
    }>;
  };

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData ?? (part.inline_data ? {
        mimeType: part.inline_data.mime_type,
        data: part.inline_data.data,
      } : undefined);

      if (inline?.data) {
        const blob = base64ToBlob(inline.data, inline.mimeType ?? "image/png");
        return URL.createObjectURL(await normalizeGeneratedImage(blob, aspect));
      }
    }
  }

  return null;
}

async function callGeminiModel(model: string, options: GenerateImageOptions): Promise<string> {
  const refs = referenceImages(options);
  const parts: unknown[] = [
    {
      text: [
        options.prompt,
        pushupGenerationLock(options),
        "",
        "FIXED OUTPUT QUALITY:",
        "Return a polished native 2K ecommerce image. The final image must be sharp, high-detail, cleanly lit, and suitable for catalog use. Avoid low-resolution, soft, blurry, compressed, or pixelated output.",
        outputSizeInstruction(options.aspect),
        "Use clean skin texture, crisp garment edges, readable text/callouts, and premium catalog clarity.",
        "",
        "REFERENCE IMAGE RULES:",
        "Use the uploaded reference images as product/model references. Preserve garment identity, color, construction, shape, and visible details.",
        "Return one finished ecommerce photoshoot image only. Do not return analysis text.",
      ].join("\n"),
    },
  ];

  for (const ref of refs) {
    parts.push({ text: `Reference image: ${ref.label}` });
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.data,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(options.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: geminiAspectRatio(options.aspect),
            imageSize: "2K",
          },
        },
      }),
    },
  );

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ??
      `Gemini request failed with ${response.status}`;
    throw new Error(message);
  }

  const imageUrl = await extractImageUrl(json, options.aspect);
  if (!imageUrl) {
    throw new Error("Gemini returned no image. Try another engine or simplify the prompt.");
  }

  return imageUrl;
}

export async function generateGeminiImage(options: GenerateImageOptions): Promise<string> {
  const errors: string[] = [];

  for (const model of modelCandidates(options.engine)) {
    try {
      return await callGeminiModel(model, options);
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join("\n"));
}
