import { type CSSProperties, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { MAX_BRA_IMAGES } from "@/lib/gear2";

const RADIUS_PCT = 35;
const MIN_SLOTS = 8;

interface CircularBraDeckProps {
  images: string[];
  onAdd: (dataUrls: string[]) => void;
  onRemove: (index: number) => void;
}

/** Bra photos as real 3D cards, fanned around a slowly spinning ring — sized in viewport units so it always fits. */
export function CircularBraDeck({ images, onAdd, onRemove }: CircularBraDeckProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const remaining = MAX_BRA_IMAGES - images.length;
  const totalSlots = Math.min(MAX_BRA_IMAGES, Math.max(images.length + 4, MIN_SLOTS));

  const ingest = async (files: FileList | File[]) => {
    const list = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, remaining));
    if (list.length === 0) return;
    const dataUrls = await Promise.all(list.map((file) => readAndDownsizeImage(file)));
    onAdd(dataUrls);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex flex-col items-center gap-5">
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
        className="bracard-stage relative mx-auto"
      >
        <div className="bracard-ring">
          {Array.from({ length: totalSlots }).map((_, index) => {
            const angle = (2 * Math.PI * index) / totalSlots - Math.PI / 2;
            const x = 50 + RADIUS_PCT * Math.cos(angle);
            const y = 50 + RADIUS_PCT * Math.sin(angle);
            const src = images[index];

            if (src) {
              return (
                <div
                  key={index}
                  className="bracard bracard--filled group"
                  style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" } as CSSProperties}
                >
                  <img src={src} alt={`Bra ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove bra ${index + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-0 right-0 text-center text-[0.65rem] font-semibold text-white/80">
                    {index + 1}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={index}
                type="button"
                onClick={openPicker}
                aria-label="Add a bra photo"
                className="bracard bracard--empty"
                style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" } as CSSProperties}
              >
                <Plus className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="bracard-hub">
          <div className="bracard-hub-ring" />
          <button
            type="button"
            onClick={openPicker}
            aria-label="Add bra photos"
            className={cn(
              "bracard-hub-btn relative flex flex-col items-center justify-center gap-1 rounded-full border text-white/80 transition-colors",
              drag ? "border-primary bg-primary/20 text-primary" : "border-white/15 bg-[#050608] hover:text-white",
            )}
          >
            <Plus className="h-6 w-6" />
            <span className="text-[0.65rem] font-semibold tracking-wide">
              {images.length}/{MAX_BRA_IMAGES}
            </span>
          </button>
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
      <p className="text-xs font-medium tracking-wide text-white/50">
        Drop bra photos anywhere in the ring, or click a card · up to {MAX_BRA_IMAGES}
      </p>
    </div>
  );
}
