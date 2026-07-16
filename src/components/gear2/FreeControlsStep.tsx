import { Sparkles, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { ASPECTS, DECKS, ENGINES, type AspectId, type Brand, type DeckType, type EngineId } from "@/lib/studio";
import { GhostLoader } from "@/components/gear2/GhostLoader";

interface FreeControlsStepProps {
  deckType: DeckType;
  validDecks: DeckType[];
  onDeckType: (id: DeckType) => void;
  brandId: string | null;
  brands: Brand[];
  onBrand: (id: string) => void;
  aspect: AspectId;
  onAspect: (id: AspectId) => void;
  engine: EngineId;
  onEngine: (id: EngineId) => void;
  ready: boolean;
  generating: boolean;
  label: string;
  onGenerate: () => void;
}

function ChipGroup<T extends string>({
  title,
  items,
  value,
  onChange,
  disabled,
}: {
  title: string;
  items: { id: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: (id: T) => boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/40">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((item) => {
          const active = value === item.id;
          const isDisabled = disabled?.(item.id) ?? false;
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(item.id)}
              className={cn(
                "gear2-chip",
                active && "gear2-chip--active",
                isDisabled && "cursor-not-allowed opacity-30",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Deck size / brand / aspect / engine — free-floating chips, no bordered panel. */
export function FreeControlsStep({
  deckType,
  validDecks,
  onDeckType,
  brandId,
  brands,
  onBrand,
  aspect,
  onAspect,
  engine,
  onEngine,
  ready,
  generating,
  label,
  onGenerate,
}: FreeControlsStepProps) {
  return (
    <div className="flex flex-col items-center gap-10">
      <ChipGroup
        title="Deck size"
        items={DECKS.map((d) => ({ id: d.id, label: d.shortLabel }))}
        value={deckType}
        onChange={onDeckType}
        disabled={(id) => !validDecks.includes(id)}
      />
      <ChipGroup
        title="Brand"
        items={brands.map((b) => ({ id: b.id, label: b.name }))}
        value={brandId ?? ""}
        onChange={onBrand}
      />
      <ChipGroup title="Aspect" items={ASPECTS.map((a) => ({ id: a.id, label: a.label }))} value={aspect} onChange={onAspect} />
      <ChipGroup title="Engine" items={ENGINES.map((e) => ({ id: e.id, label: e.label }))} value={engine} onChange={onEngine} />

      <div className={cn("flex flex-col items-center gap-3", !ready && "opacity-40")}>
        <GhostLoader
          size="lg"
          onClick={ready ? onGenerate : undefined}
          className={cn(!ready && "cursor-not-allowed", ready && !generating && "hover:scale-105")}
        />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {generating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
          {label}
        </span>
      </div>
    </div>
  );
}
