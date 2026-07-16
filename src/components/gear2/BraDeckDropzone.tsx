import { type CSSProperties, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { MAX_BRA_IMAGES } from "@/lib/gear2";

const CARD_COLORS = [
  "142, 249, 252",
  "142, 252, 204",
  "142, 252, 157",
  "215, 252, 142",
  "252, 252, 142",
  "252, 208, 142",
  "252, 142, 142",
  "252, 142, 239",
  "204, 142, 252",
  "142, 202, 252",
  "180, 142, 252",
  "142, 252, 226",
];

interface BraDeckDropzoneProps {
  images: string[];
  onAdd: (dataUrls: string[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

/** The big 3D rotating card deck — drop or pick up to MAX_BRA_IMAGES bra photos. */
export function BraDeckDropzone({ images, onAdd, onRemove, onClear }: BraDeckDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const remaining = MAX_BRA_IMAGES - images.length;

  const ingest = async (files: FileList | File[]) => {
    const list = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, remaining));
    if (list.length === 0) return;
    const dataUrls = await Promise.all(list.map((file) => readAndDownsizeImage(file)));
    onAdd(dataUrls);
  };

  return (
    <div className="space-y-2.5">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (remaining > 0) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) void ingest(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        className={cn(
          "deck3d-wrapper h-56 cursor-pointer rounded-2xl border border-dashed transition-colors sm:h-64",
          drag ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/50",
        )}
      >
        <div className="deck3d-inner" style={{ "--deck3d-quantity": MAX_BRA_IMAGES } as CSSProperties}>
          {Array.from({ length: MAX_BRA_IMAGES }).map((_, index) => (
            <div
              key={index}
              className="deck3d-card"
              style={
                {
                  "--deck3d-index": index,
                  "--deck3d-color-card": CARD_COLORS[index % CARD_COLORS.length],
                } as CSSProperties
              }
            >
              {images[index] ? (
                <img src={images[index]} alt={`Bra ${index + 1}`} className="deck3d-img" />
              ) : (
                <div className="deck3d-img" />
              )}
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void ingest(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {images.length}/{MAX_BRA_IMAGES} bras added
        </span>
        {images.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-medium text-destructive hover:underline">
            Clear all
          </button>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, index) => (
            <div key={index} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-border">
              <img src={src} alt={`Bra ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove bra ${index + 1}`}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-paper/90 text-foreground shadow hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
