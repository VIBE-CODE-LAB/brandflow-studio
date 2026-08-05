import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Check, Loader2, Plus, RefreshCw, Unlink, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { useBookInAppShortcuts } from "@/lib/bookShortcuts";
import {
  ASPECTS,
  DECKS,
  ENGINES,
  SHOOT_TYPES,
  allowedDecks,
  defaultDeck,
  requiredSlots,
  slotLabel,
  type AspectId,
  type Brand,
  type DeckType,
  type EngineId,
  type ShootType,
  type SlotKey,
} from "@/lib/studio";
import { searchStylesByNumber, type StylePreset } from "@/lib/stylePresets";

const BASE_URL = import.meta.env.BASE_URL;

/** open.mp4 settles on a flat, fully blank two-page spread starting around this timestamp. */
const OPEN_SETTLE_TIME = 8.3;
/** flip.mp4 already starts on a blank flat spread and settles back to one near the end. */
const FLIP_END_TIME = 9.8;

type Phase = "opening" | "mode-select" | "flipping" | "panty" | "controls" | "advancing";

interface BookViewProps {
  onClose: () => void;
  availableBrands: Brand[];
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  presets: StylePreset[];
}

function DropZone({
  label,
  value,
  onFile,
  onClear,
}: {
  label: string;
  value?: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={cn(
          "relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-[#8E173C]/50 bg-[#FFF8F2]/70 transition-colors sm:h-28 sm:w-28",
          drag && "border-[#8E173C] bg-[#FFF8F2]",
          value && "cursor-default border-solid",
        )}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="h-full w-full rounded-full object-cover" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              aria-label={`Remove ${label}`}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#8E173C] text-white shadow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <Plus className="h-8 w-8 text-[#8E173C]/70" strokeWidth={1.5} />
        )}
      </div>
      <span className="text-xs font-medium tracking-wide text-[#444044]">{label}</span>
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

function PageHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8E173C]/60">
      {children}
    </p>
  );
}

function MiniChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
        active
          ? "border-transparent bg-[#8E173C] text-white"
          : "border-[#8E173C]/30 bg-[#FFF8F2]/60 text-[#8E173C] hover:bg-[#FFF8F2]",
      )}
    >
      {children}
    </button>
  );
}

export function BookView({
  onClose,
  availableBrands,
  sheetUrl,
  onSheetUrlChange,
  onSync,
  onDisconnect,
  syncing,
  syncMessage,
  syncError,
  presets,
}: BookViewProps) {
  const [phase, setPhase] = useState<Phase>("opening");
  const [shootType, setShootType] = useState<ShootType>("bra_panty");
  const [images, setImages] = useState<Partial<Record<SlotKey, string>>>({});
  const [deck, setDeck] = useState<DeckType>("deck_5");
  const [brandId, setBrandId] = useState<string | null>(availableBrands[0]?.id ?? null);
  const [aspect, setAspect] = useState<AspectId>("3:4");
  const [engine, setEngine] = useState<EngineId>("fast");
  const [selectedStyleName, setSelectedStyleName] = useState<string | null>(null);
  const [styleSearch, setStyleSearch] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const slots = requiredSlots(shootType, false);
  const needsFlip = slots.length === 3;
  const primarySlots = needsFlip ? slots.slice(0, 2) : slots;
  const deferredSlot: SlotKey | null = needsFlip ? slots[2] : null;
  const validDecks = allowedDecks(shootType);

  useEffect(() => {
    if (brandId && availableBrands.some((b) => b.id === brandId)) return;
    setBrandId(availableBrands[0]?.id ?? null);
  }, [availableBrands, brandId]);

  const setImage = useCallback((slot: SlotKey, file: File) => {
    void readAndDownsizeImage(file).then((dataUrl) => {
      setImages((prev) => ({ ...prev, [slot]: dataUrl }));
    });
  }, []);

  const clearImage = useCallback((slot: SlotKey) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  const changeShootType = useCallback((next: ShootType) => {
    setShootType(next);
    setDeck(defaultDeck(next));
    setImages((prev) => {
      const keep = requiredSlots(next, false);
      const cleaned: Partial<Record<SlotKey, string>> = {};
      for (const key of Object.keys(prev) as SlotKey[]) {
        if (keep.includes(key)) cleaned[key] = prev[key];
      }
      return cleaned;
    });
  }, []);

  const changeDeck = useCallback(
    (next: DeckType) => {
      if (!validDecks.includes(next)) return;
      setDeck(next);
    },
    [validDecks],
  );

  // Play open.mp4 once on mount, pausing at the settled blank-spread frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const onTimeUpdate = () => {
      if (video.currentTime >= OPEN_SETTLE_TIME) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
        if (!cancelled) setPhase("mode-select");
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.currentTime = 0;
    void video.play();
    return () => {
      cancelled = true;
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  const playFlip = useCallback((onDone: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    setPhase("flipping");
    const onTimeUpdate = () => {
      if (video.currentTime >= FLIP_END_TIME) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
        onDone();
      }
    };
    video.src = `${BASE_URL}book/flip.mp4`;
    video.addEventListener("timeupdate", onTimeUpdate);
    const onLoaded = () => {
      video.currentTime = 0;
      void video.play();
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, []);

  const primaryReady = primarySlots.every((slot) => images[slot]);
  const pantyReady = !deferredSlot || Boolean(images[deferredSlot]);

  const handleEnter = useCallback(() => {
    if (phase === "mode-select") {
      if (!primaryReady) return;
      playFlip(() => setPhase(needsFlip ? "panty" : "controls"));
      return;
    }
    if (phase === "panty") {
      if (!pantyReady) return;
      playFlip(() => setPhase("controls"));
      return;
    }
    if (phase === "controls") {
      if (!brandId) return;
      setPhase("advancing");
    }
  }, [phase, primaryReady, needsFlip, pantyReady, brandId, playFlip]);

  useBookInAppShortcuts({
    onEnter: handleEnter,
    onClose,
    enabled: true,
  });

  const styleMatches = useMemo(
    () => (styleSearch.trim() ? searchStylesByNumber(presets, styleSearch.trim()) : []),
    [presets, styleSearch],
  );

  const showsPageContent = phase === "mode-select" || phase === "panty" || phase === "controls";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      <div
        className="relative"
        style={{
          width: "max(100vw, calc(100vh * 16 / 9))",
          height: "max(100vh, calc(100vw * 9 / 16))",
          transform: "scale(1.2)",
        }}
      >
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover">
          <source src={`${BASE_URL}book/open.mp4`} type="video/mp4" />
        </video>

        {showsPageContent ? (
          <div className="absolute inset-0">
            {phase === "mode-select" ? (
              <>
                {/* Left page — mode selection */}
                <div className="absolute left-[29%] top-[20%] flex h-[57%] w-[18%] flex-col items-center justify-center gap-3">
                  {SHOOT_TYPES.map((t) => {
                    const active = shootType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => changeShootType(t.id)}
                        className={cn(
                          "w-full rounded-full border px-4 py-2 text-sm font-semibold tracking-wide transition-colors",
                          active
                            ? "border-transparent text-white shadow-md"
                            : "border-[#8E173C]/40 bg-[#FFF8F2]/70 text-[#8E173C] hover:bg-[#FFF8F2]",
                        )}
                        style={active ? { background: t.tint } : undefined}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right page — image drop zones */}
                <div className="absolute left-[53%] top-[20%] flex h-[57%] w-[18%] flex-col items-center justify-center gap-6">
                  {primarySlots.map((slot) => (
                    <DropZone
                      key={slot}
                      label={slotLabel(slot, shootType)}
                      value={images[slot]}
                      onFile={(file) => setImage(slot, file)}
                      onClear={() => clearImage(slot)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {phase === "panty" ? (
              <>
                <div className="absolute left-[29%] top-[20%] flex h-[57%] w-[18%] flex-col items-center justify-center">
                  <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-[#8E173C]/60">
                    Step 2 of 2
                  </p>
                </div>
                <div className="absolute left-[53%] top-[20%] flex h-[57%] w-[18%] flex-col items-center justify-center">
                  {deferredSlot ? (
                    <DropZone
                      label={slotLabel(deferredSlot, shootType)}
                      value={images[deferredSlot]}
                      onFile={(file) => setImage(deferredSlot, file)}
                      onClear={() => clearImage(deferredSlot)}
                    />
                  ) : null}
                </div>
              </>
            ) : null}

            {phase === "controls" ? (
              <>
                {/* Left page — deck + brand table */}
                <div className="absolute left-[29%] top-[20%] flex h-[57%] w-[18%] flex-col overflow-y-auto px-1">
                  <PageHeading>Deck</PageHeading>
                  <div className="flex flex-col gap-1.5">
                    {DECKS.map((d) => {
                      const active = deck === d.id;
                      const disabled = !validDecks.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => changeDeck(d.id)}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                            active
                              ? "border-[#8E173C] bg-[#8E173C]/10"
                              : "border-[#8E173C]/25 bg-[#FFF8F2]/60 hover:bg-[#FFF8F2]",
                            disabled && "cursor-not-allowed opacity-40",
                          )}
                        >
                          <span className="block text-[11px] font-semibold text-[#8E173C]">
                            {d.shortLabel}
                          </span>
                          <span className="block text-[9px] leading-snug text-[#444044]">{d.hint}</span>
                        </button>
                      );
                    })}
                  </div>

                  <PageHeading>
                    <span className="mt-3 block">Brand</span>
                  </PageHeading>
                  <table className="w-full border-collapse text-[11px]">
                    <tbody>
                      {availableBrands.map((b) => {
                        const active = brandId === b.id;
                        return (
                          <tr
                            key={b.id}
                            onClick={() => setBrandId(b.id)}
                            className={cn(
                              "cursor-pointer border-b border-[#8E173C]/10",
                              active && "bg-[#8E173C]/10",
                            )}
                          >
                            <td className="w-5 py-1.5 pl-1">
                              <span
                                className="block h-3 w-3 rounded-full border border-black/10"
                                style={{ background: b.bg }}
                              />
                            </td>
                            <td
                              className={cn(
                                "py-1.5 pr-1 font-medium",
                                active ? "text-[#8E173C]" : "text-[#444044]",
                              )}
                            >
                              {b.name}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Right page — aspect / engine / style preset */}
                <div className="absolute left-[53%] top-[20%] flex h-[57%] w-[18%] flex-col gap-4 overflow-y-auto px-1">
                  <div>
                    <PageHeading>Aspect</PageHeading>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {ASPECTS.map((a) => (
                        <MiniChip key={a.id} active={aspect === a.id} onClick={() => setAspect(a.id)}>
                          {a.label}
                        </MiniChip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <PageHeading>Engine</PageHeading>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {ENGINES.map((e) => (
                        <MiniChip key={e.id} active={engine === e.id} onClick={() => setEngine(e.id)}>
                          {e.label}
                        </MiniChip>
                      ))}
                    </div>
                  </div>

                  <div>
                    <PageHeading>Style preset</PageHeading>
                    <div className="flex flex-col items-center gap-1.5">
                      <input
                        value={sheetUrl}
                        onChange={(e) => onSheetUrlChange(e.target.value)}
                        placeholder="Google Sheet URL"
                        className="w-full rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2.5 py-1 text-[10px] text-[#444044] outline-none placeholder:text-[#444044]/50"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!sheetUrl.trim() || syncing}
                          onClick={onSync}
                          className="flex items-center gap-1 rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2.5 py-1 text-[10px] font-medium text-[#8E173C] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {syncing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Sync
                        </button>
                        {sheetUrl ? (
                          <button
                            type="button"
                            onClick={onDisconnect}
                            aria-label="Disconnect style sheet"
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 text-[#8E173C]"
                          >
                            <Unlink className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                      {presets.length > 0 ? (
                        <p className="text-[9px] text-[#444044]/70">{presets.length} rows synced</p>
                      ) : null}
                      {syncMessage ? (
                        <p className="flex items-center gap-1 text-[9px] text-emerald-700">
                          <Check className="h-2.5 w-2.5 shrink-0" />
                          {syncMessage}
                        </p>
                      ) : null}
                      {syncError ? <p className="text-[9px] text-red-700">{syncError}</p> : null}

                      <input
                        value={styleSearch}
                        onChange={(e) => setStyleSearch(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Search style №"
                        inputMode="numeric"
                        disabled={presets.length === 0}
                        className="w-full rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2.5 py-1 text-[10px] text-[#444044] outline-none placeholder:text-[#444044]/50 disabled:cursor-not-allowed disabled:opacity-40"
                      />

                      {selectedStyleName ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-[#8E173C] px-2.5 py-1 text-[10px] font-medium text-white">
                          {selectedStyleName}
                          <button
                            type="button"
                            onClick={() => setSelectedStyleName(null)}
                            aria-label="Clear style"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : null}

                      {styleMatches.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {styleMatches.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setSelectedStyleName(name);
                                setStyleSearch("");
                              }}
                              className="rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2 py-0.5 text-[10px] text-[#8E173C]"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-xs font-medium tracking-wide text-white/70">
              Press Enter to continue
            </p>
          </div>
        ) : null}

        {phase === "advancing" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/60 px-6 py-3 text-sm font-medium tracking-wide text-white">
              Continuing to close &amp; generate — coming in Stage 3
            </p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close Book View"
        className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white"
      >
        <X className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
