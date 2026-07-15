import { type DeckShotKey, type EngineId, type SlotKey, type ShootType, requiredSlots, slotLabel } from "@/lib/studio";
import type { ImageMap } from "@/components/studio/UploadTray";

interface GenerateImageOptions {
  apiKey: string;
  prompt: string;
  images: ImageMap;
  shootType: ShootType;
  pushupBraOnly: boolean;
  deckShot: DeckShotKey;
  engine: EngineId;
}

interface InlineImage {
  label: string;
  mimeType: string;
  data: string;
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
  return engine === "pro"
    ? ["gemini-3-pro-image-preview", "gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"]
    : ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
}

function extractImageUrl(response: unknown): string | null {
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
        return `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`;
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

  const imageUrl = extractImageUrl(json);
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
