import { useCallback, useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { type ShootType, type SlotKey, requiredSlots, slotLabel } from "@/lib/studio";

export type ImageMap = Partial<Record<string, string>>;

interface UploadTrayProps {
  shootType: ShootType;
  pushupBraOnly: boolean;
  images: ImageMap;
  onChange: (key: string, value: string | null) => void;
  needsBack: boolean;
}

const MAX_UPLOAD_EDGE = 900;
const UPLOAD_QUALITY = 0.72;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function readFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return await blobToDataUrl(file);

    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_QUALITY),
    );
    return await blobToDataUrl(blob ?? file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Slot({
  label,
  value,
  onFile,
  onClear,
  small,
}: {
  label: string;
  value?: string;
  onFile: (f: File) => void;
  onClear: () => void;
  small?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const filled = Boolean(value);

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center transition-all",
        small ? "h-24" : "h-32",
        drag
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : filled
            ? "border-solid border-border bg-muted/40"
            : "border-border hover:border-primary/60 hover:bg-primary/5",
      )}
    >
      {filled ? (
        <>
          <img src={value} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
          <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="h-3 w-3" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-paper/90 text-foreground shadow hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3 w-3" />
          </span>
          <span className="absolute bottom-1.5 left-0 right-0 text-xs font-medium text-paper">
            {label}
          </span>
        </>
      ) : (
        <>
          <ImagePlus className="mb-1 h-5 w-5 text-primary/70" />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-[0.68rem] text-muted-foreground">drop or click</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

export function UploadTray({
  shootType,
  pushupBraOnly,
  images,
  onChange,
  needsBack,
}: UploadTrayProps) {
  const slots = requiredSlots(shootType, pushupBraOnly);
  const [showBack, setShowBack] = useState(false);

  const handleFile = useCallback(
    async (key: string, file: File) => {
      const data = await readFile(file);
      onChange(key, data);
    },
    [onChange],
  );

  const backSlots: SlotKey[] = slots; // same product slots, back-facing

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", slots.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {slots.map((slot) => (
          <Slot
            key={slot}
            label={slotLabel(slot, shootType)}
            value={images[slot]}
            onFile={(f) => handleFile(slot, f)}
            onClear={() => onChange(slot, null)}
          />
        ))}
      </div>

      {needsBack && (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
          <button
            type="button"
            onClick={() => setShowBack((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
              Back-facing photos
              <span className="text-xs font-normal text-muted-foreground">
                (used only for the Back pose)
              </span>
            </span>
            <span className="text-xs text-primary">{showBack ? "Hide" : "Add"}</span>
          </button>
          {showBack && (
            <div
              className={cn(
                "mt-3 grid gap-3",
                backSlots.length === 3 ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              {backSlots.map((slot) => (
                <Slot
                  key={`${slot}Back`}
                  small
                  label={`${slotLabel(slot, shootType)} · back`}
                  value={images[`${slot}Back`]}
                  onFile={(f) => handleFile(`${slot}Back`, f)}
                  onClear={() => onChange(`${slot}Back`, null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
