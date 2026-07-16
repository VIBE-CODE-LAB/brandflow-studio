import { type CSSProperties, useRef, useState } from "react";
import { Check, ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { SHOOT_TYPES, requiredSlots, type ShootType, type SlotKey } from "@/lib/studio";
import type { ImageMap } from "@/components/studio/UploadTray";

const SLOT_LABEL: Record<Exclude<SlotKey, "bra">, string> = {
  model: "Model",
  panty: "Panty",
};

const CARD_COLORS = ["142, 202, 252", "252, 142, 200"];

interface TwinCardStepProps {
  shootType: ShootType;
  pushupBraOnly: boolean;
  images: ImageMap;
  onShootTypeChange: (next: ShootType) => void;
  onImageChange: (key: string, value: string | null) => void;
}

function Slot({
  slot,
  index,
  quantity,
  value,
  onFile,
}: {
  slot: Exclude<SlotKey, "bra">;
  index: number;
  quantity: number;
  value?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      className="deck3d-card cursor-pointer"
      style={
        {
          "--deck3d-index": index,
          "--deck3d-color-card": CARD_COLORS[index % CARD_COLORS.length],
        } as CSSProperties
      }
      onClick={() => inputRef.current?.click()}
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
    >
      {value ? (
        <img src={value} alt={SLOT_LABEL[slot]} className="deck3d-img" />
      ) : (
        <div className={cn("deck3d-img flex flex-col items-center justify-center gap-1", drag && "ring-2 ring-white/60")}>
          <ImagePlus className="h-5 w-5 text-white/70" />
        </div>
      )}
      <span className="absolute bottom-2 left-0 right-0 text-center text-xs font-semibold text-white drop-shadow">
        {SLOT_LABEL[slot]}
      </span>
      {value ? (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3 w-3" />
        </span>
      ) : null}
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
      {/* quantity kept for parity with deck3d-inner's --deck3d-quantity var, unused per-card */}
      <span className="hidden">{quantity}</span>
    </div>
  );
}

/** Model (+Panty, if the shoot type needs it) as two rotating 3D cards — the second vanishes when not needed. */
export function TwinCardStep({ shootType, pushupBraOnly, images, onShootTypeChange, onImageChange }: TwinCardStepProps) {
  const slots = requiredSlots(shootType, pushupBraOnly).filter((s): s is Exclude<SlotKey, "bra"> => s !== "bra");
  const quantity = slots.length;

  const handleFile = async (key: string, file: File) => {
    const data = await readAndDownsizeImage(file);
    onImageChange(key, data);
  };

  return (
    <div className="flex flex-col items-center gap-8">
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

      <div className="gear2-glow deck3d-wrapper">
        <div className="deck3d-inner" style={{ "--deck3d-quantity": quantity } as CSSProperties}>
          {slots.map((slot, index) => (
            <Slot
              key={slot}
              slot={slot}
              index={index}
              quantity={quantity}
              value={images[slot]}
              onFile={(file) => handleFile(slot, file)}
            />
          ))}
        </div>
      </div>
      <p className="text-xs font-medium tracking-wide text-white/50">Drop or click a card to add that photo · hover to pause</p>
    </div>
  );
}
