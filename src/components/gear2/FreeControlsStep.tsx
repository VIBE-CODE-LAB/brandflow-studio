import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, Unlink, X, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTilt } from "@/lib/useTilt";
import {
  ASPECTS,
  DECKS,
  ENGINES,
  type AspectId,
  type Brand,
  type DeckShotKey,
  type DeckType,
  type EngineId,
} from "@/lib/studio";
import { findPreset, isPresetPose, searchStylesByNumber, type StylePreset } from "@/lib/stylePresets";
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
  activeDeckShots: DeckShotKey[];
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  presets: StylePreset[];
  selectedStyleName: string | null;
  onSelectStyle: (styleName: string | null) => void;
  ready: boolean;
  generating: boolean;
  label: string;
  onGenerate: () => void;
}

function TiltChip({
  active,
  disabled,
  onClick,
  activeStyle,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  activeStyle?: CSSProperties;
  children: ReactNode;
}) {
  const tilt = useTilt({ max: 12, scale: 1.08 });
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={{ ...tilt.style, ...(active ? activeStyle : undefined) }}
      className={cn("gear2-chip", active && "gear2-chip--active", disabled && "cursor-not-allowed opacity-30")}
    >
      {children}
    </button>
  );
}

function ChipGroup<T extends string>({
  title,
  items,
  value,
  onChange,
  disabled,
}: {
  title: string;
  items: { id: T; label: string; disabled?: boolean; tint?: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: (id: T) => boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/40">{title}</p>
      <div className="flex flex-wrap justify-center gap-2.5">
        {items.map((item) => (
          <TiltChip
            key={item.id}
            active={value === item.id}
            disabled={disabled?.(item.id) ?? false}
            onClick={() => onChange(item.id)}
            activeStyle={item.tint ? { background: item.tint, color: "#fff" } : undefined}
          >
            {item.label}
          </TiltChip>
        ))}
      </div>
    </div>
  );
}

function StyleSection({
  sheetUrl,
  onSheetUrlChange,
  onSync,
  onDisconnect,
  syncing,
  syncMessage,
  syncError,
  presets,
  selectedStyleName,
  onSelectStyle,
  activeDeckShots,
}: Pick<
  FreeControlsStepProps,
  | "sheetUrl"
  | "onSheetUrlChange"
  | "onSync"
  | "onDisconnect"
  | "syncing"
  | "syncMessage"
  | "syncError"
  | "presets"
  | "selectedStyleName"
  | "onSelectStyle"
  | "activeDeckShots"
>) {
  const [search, setSearch] = useState("");
  const posesInDeck = useMemo(() => activeDeckShots.filter(isPresetPose), [activeDeckShots]);
  const matches = useMemo(
    () => (search.trim() ? searchStylesByNumber(presets, search.trim()) : []),
    [presets, search],
  );
  const coverageFor = (styleName: string) => posesInDeck.filter((pose) => findPreset(presets, styleName, pose)).length;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/40">Style preset</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          value={sheetUrl}
          onChange={(e) => onSheetUrlChange(e.target.value)}
          placeholder="Google Sheet URL"
          className="gear2-input w-56"
        />
        <button
          type="button"
          disabled={!sheetUrl.trim() || syncing}
          onClick={onSync}
          className="gear2-chip flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync
        </button>
        {sheetUrl ? (
          <button type="button" onClick={onDisconnect} className="gear2-chip">
            <Unlink className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {presets.length > 0 ? <p className="text-[0.68rem] text-white/40">{presets.length} rows synced</p> : null}
      {syncMessage ? (
        <p className="flex items-center gap-1.5 text-[0.68rem] text-emerald-400">
          <Check className="h-3 w-3 shrink-0" />
          {syncMessage}
        </p>
      ) : null}
      {syncError ? <p className="text-[0.68rem] text-red-400">{syncError}</p> : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Search style № (e.g. 68)"
        inputMode="numeric"
        disabled={presets.length === 0}
        className="gear2-input w-56 disabled:cursor-not-allowed disabled:opacity-30"
      />

      {selectedStyleName ? (
        <div className="gear2-chip gear2-chip--active flex items-center gap-2">
          {selectedStyleName}
          <button type="button" onClick={() => onSelectStyle(null)} aria-label="Clear style">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="flex max-w-md flex-wrap justify-center gap-2">
          {matches.map((styleName) => (
            <button
              key={styleName}
              type="button"
              onClick={() => {
                onSelectStyle(styleName);
                setSearch("");
              }}
              className="gear2-chip"
            >
              {styleName}
              <span className="ml-1.5 text-white/40">
                {coverageFor(styleName)}/{posesInDeck.length}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {!search.trim() && !selectedStyleName ? (
        <p className="max-w-xs text-center text-[0.68rem] text-white/40">
          {presets.length === 0
            ? "Sync a Google Sheet, then search a style number to apply its callouts to every bra deck."
            : "Type a style number to apply it across every bra deck."}
        </p>
      ) : null}
    </div>
  );
}

/** Deck size / brand / aspect / engine / style — free-floating, magnetically tilting chips, no bordered panel. */
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
  activeDeckShots,
  sheetUrl,
  onSheetUrlChange,
  onSync,
  onDisconnect,
  syncing,
  syncMessage,
  syncError,
  presets,
  selectedStyleName,
  onSelectStyle,
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

      <StyleSection
        sheetUrl={sheetUrl}
        onSheetUrlChange={onSheetUrlChange}
        onSync={onSync}
        onDisconnect={onDisconnect}
        syncing={syncing}
        syncMessage={syncMessage}
        syncError={syncError}
        presets={presets}
        selectedStyleName={selectedStyleName}
        onSelectStyle={onSelectStyle}
        activeDeckShots={activeDeckShots}
      />

      <div className={cn("gear2-glow flex flex-col items-center gap-3 py-2", !ready && "opacity-40")}>
        <GhostLoader
          size="lg"
          onClick={ready ? onGenerate : undefined}
          className={cn(!ready && "cursor-not-allowed", ready && !generating && "hover:scale-110")}
        />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {generating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
          {label}
        </span>
      </div>
    </div>
  );
}
