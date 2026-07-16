import { type CSSProperties, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { MAX_BRA_IMAGES } from "@/lib/gear2";

const RADIUS = 150;
const SIZE = 400;

interface CircularBraDeckProps {
  images: string[];
  onAdd: (dataUrls: string[]) => void;
  onRemove: (index: number) => void;
}

/** Bra photos arranged freely in a ring around a center drop hub — no boxes. */
export function CircularBraDeck({ images, onAdd, onRemove }: CircularBraDeckProps) {
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
    <div className="flex flex-col items-center gap-4">
      <div
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
        className="relative mx-auto"
        style={{ width: SIZE, height: SIZE }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Add bra photos"
          className={cn(
            "absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full border-2 border-dashed text-white/70 transition-colors",
            drag ? "border-primary bg-primary/10 text-primary" : "border-white/25 hover:border-white/50",
          )}
        >
          <Plus className="h-6 w-6" />
          <span className="text-[0.65rem] font-semibold tracking-wide">
            {images.length}/{MAX_BRA_IMAGES}
          </span>
        </button>

        {images.map((src, index) => {
          const angle = (2 * Math.PI * index) / Math.max(images.length, 1) - Math.PI / 2;
          const x = SIZE / 2 + RADIUS * Math.cos(angle);
          const y = SIZE / 2 + RADIUS * Math.sin(angle);
          return (
            <div
              key={index}
              className="circle-float group absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: x, top: y, animationDelay: `${(index % 6) * 0.35}s` } as CSSProperties}
            >
              <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/20 shadow-lg shadow-black/40">
                <img src={src} alt={`Bra ${index + 1}`} className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove bra ${index + 1}`}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

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
      <p className="text-xs font-medium tracking-wide text-white/50">
        Drop bra photos anywhere in the ring · up to {MAX_BRA_IMAGES}
      </p>
    </div>
  );
}
