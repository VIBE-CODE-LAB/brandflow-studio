import { type CSSProperties, useRef, useState } from "react";
import { Check, ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { useTilt } from "@/lib/useTilt";
import { SHOOT_TYPES, requiredSlots, type ShootType, type SlotKey } from "@/lib/studio";
import type { ImageMap } from "@/components/studio/UploadTray";

const SLOT_LABEL: Record<Exclude<SlotKey, "bra">, string> = {
  model: "Model",
  panty: "Panty",
};

const CARD_TINT: Record<Exclude<SlotKey, "bra">, string> = {
  model: "142, 202, 252",
  panty: "252, 142, 200",
};

interface TwinCardStepProps {
  shootType: ShootType;
  pushupBraOnly: boolean;
  images: ImageMap;
  onShootTypeChange: (next: ShootType) => void;
  onImageChange: (key: string, value: string | null) => void;
}

function Slot({
  slot,
  value,
  onFile,
}: {
  slot: Exclude<SlotKey, "bra">;
  value?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const tilt = useTilt({ max: 14, scale: 1.05 });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-lg font-bold tracking-wide text-white">{SLOT_LABEL[slot]}</p>
      <div
        onClick={() => inputRef.current?.click()}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        style={{ ...tilt.style, "--twincard-color": CARD_TINT[slot] } as CSSProperties}
        className={cn("twincard cursor-pointer", drag && "twincard--drag")}
      >
        {value ? (
          <img src={value} alt={SLOT_LABEL[slot]} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 text-white/60">
            <ImagePlus className="h-9 w-9" />
            <span className="text-sm font-semibold">Drop or click</span>
          </div>
        )}
        {value ? (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Model (+Panty, if the shoot type needs it) as two big cards that tilt freely toward the cursor — no box, no forced spin. */
export function TwinCardStep({ shootType, pushupBraOnly, images, onShootTypeChange, onImageChange }: TwinCardStepProps) {
  const slots = requiredSlots(shootType, pushupBraOnly).filter((s): s is Exclude<SlotKey, "bra"> => s !== "bra");

  const handleFile = async (key: string, file: File) => {
    const data = await readAndDownsizeImage(file);
    onImageChange(key, data);
  };

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-wrap justify-center gap-2">
        {SHOOT_TYPES.map((t) => {
          const active = shootType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onShootTypeChange(t.id)}
              className={cn("gear2-chip", active && "gear2-chip--active")}
              style={active ? { background: t.tint, color: "#fff" } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-10">
        {slots.map((slot) => (
          <Slot key={slot} slot={slot} value={images[slot]} onFile={(file) => handleFile(slot, file)} />
        ))}
      </div>

      <p className="text-xs font-medium tracking-wide text-white/50">Drop or click a card to add that photo</p>
    </div>
  );
}
