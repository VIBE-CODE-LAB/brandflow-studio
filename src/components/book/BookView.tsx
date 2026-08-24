import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Check, Clipboard, Download, Loader2, Plus, RefreshCw, Unlink, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { readAndDownsizeImage } from "@/lib/imageFile";
import { runLimited } from "@/lib/concurrency";
import { useBookInAppShortcuts } from "@/lib/bookShortcuts";
import { getGeminiApiKey, incrementStudioUsage, type StudioAuthState } from "@/lib/studioAuth";
import { findPreset, isPresetPose, searchStylesByNumber, type StylePreset } from "@/lib/stylePresets";
import { downloadShot, downloadShotsZip } from "@/components/studio/Stage";
import {
  ASPECTS,
  DECK_SHOT_LABELS,
  DECKS,
  ENGINES,
  SHOOT_TYPES,
  allowedDecks,
  defaultDeck,
  getDeck,
  requiredSlots,
  slotLabel,
  type AspectId,
  type Brand,
  type DeckType,
  type EngineId,
  type GeneratedShot,
  type ShootType,
  type SlotKey,
} from "@/lib/studio";

const BASE_URL = import.meta.env.BASE_URL;
const GENERATION_CONCURRENCY = 5;

/** open.mp4 settles on a flat, fully blank two-page spread starting around this timestamp. */
const OPEN_SETTLE_TIME = 8.3;
/** flip.mp4 already starts on a blank flat spread and settles back to one near the end. */
const FLIP_END_TIME = 9.8;
/** close.mp4 settles on a calm, closed, centered pose around this timestamp. */
const CLOSE_SETTLE_TIME = 9.3;
/** surge.mp4's crackle+tilt is a one-way settle arc — the tilt itself lives roughly here. */
const TILT_LOOP_START = 5.0;
const TILT_LOOP_END = 7.0;
/** reopen.mp4 settles on a flat, fully blank two-page spread around this timestamp. */
const REOPEN_SETTLE_TIME = 9.3;

type Phase =
  | "opening"
  | "mode-select"
  | "flipping"
  | "panty"
  | "controls"
  | "closing"
  | "generating"
  | "ready-to-open"
  | "surging"
  | "tilt-loop"
  | "reopening"
  | "review"
  | "downloads";

let bookShotCounter = 0;
const nextBookShotId = () => `book-shot-${Date.now()}-${bookShotCounter++}`;

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
  auth: StudioAuthState;
  onNeedAuth: () => void;
  onAuthUsed: (used: number) => void;
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
  auth,
  onNeedAuth,
  onAuthUsed,
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
  const [shots, setShots] = useState<GeneratedShot[]>([]);
  const [generating, setGenerating] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [redoNote, setRedoNote] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const generatedUrls = useRef<string[]>([]);

  const slots = requiredSlots(shootType, false);
  const needsFlip = slots.length === 3;
  const primarySlots = needsFlip ? slots.slice(0, 2) : slots;
  const deferredSlot: SlotKey | null = needsFlip ? slots[2] : null;
  const validDecks = allowedDecks(shootType);

  useEffect(() => {
    if (brandId && availableBrands.some((b) => b.id === brandId)) return;
    setBrandId(availableBrands[0]?.id ?? null);
  }, [availableBrands, brandId]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearInterval);
      generatedUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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

  const playClose = useCallback((onDone: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    setPhase("closing");
    const onTimeUpdate = () => {
      if (video.currentTime >= CLOSE_SETTLE_TIME) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
        onDone();
      }
    };
    video.src = `${BASE_URL}book/close.mp4`;
    video.addEventListener("timeupdate", onTimeUpdate);
    const onLoaded = () => {
      video.currentTime = 0;
      void video.play();
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, []);

  const playSurgeOnce = useCallback((onDone: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    setPhase("surging");
    const onEnded = () => onDone();
    video.src = `${BASE_URL}book/surge.mp4`;
    video.addEventListener("ended", onEnded, { once: true });
    const onLoaded = () => {
      video.currentTime = 0;
      void video.play();
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, []);

  const playReopen = useCallback((onDone: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    setPhase("reopening");
    const onTimeUpdate = () => {
      if (video.currentTime >= REOPEN_SETTLE_TIME) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
        onDone();
      }
    };
    video.src = `${BASE_URL}book/reopen.mp4`;
    video.addEventListener("timeupdate", onTimeUpdate);
    const onLoaded = () => {
      video.currentTime = 0;
      void video.play();
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, []);

  // Loop the tilt segment of surge.mp4 until the user presses Enter to reopen.
  useEffect(() => {
    if (phase !== "tilt-loop") return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = TILT_LOOP_START;
    void video.play();
    const onTimeUpdate = () => {
      if (video.currentTime >= TILT_LOOP_END) {
        video.currentTime = TILT_LOOP_START;
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [phase]);

  const startProgress = useCallback((id: string, start = 3) => {
    setShots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, progress: Math.max(s.progress ?? 0, start) } : s)),
    );
    const timer = setInterval(() => {
      setShots((prev) =>
        prev.map((s) => {
          if (s.id !== id || s.status !== "rendering") return s;
          const current = s.progress ?? start;
          const step = current < 50 ? 4 : current < 80 ? 2 : 1;
          return { ...s, progress: Math.min(92, current + step) };
        }),
      );
    }, 900);
    timers.current.push(timer);
    return timer;
  }, []);

  const generate = useCallback(async () => {
    const brand = availableBrands.find((b) => b.id === brandId) ?? availableBrands[0];
    if (!brand) {
      setGenerating(false);
      return;
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      onNeedAuth();
      setGenerating(false);
      return;
    }

    const used = incrementStudioUsage();
    onAuthUsed(used);

    const deckShots = getDeck(deck).shots;
    const queued: GeneratedShot[] = deckShots.map((deckShot) => ({
      id: nextBookShotId(),
      deckShot,
      aspect,
      brandId: brand.id,
      shootType,
      pushupBraOnly: false,
      status: "queued",
      progress: 0,
    }));
    setShots(queued);

    const [{ composeDeckPrompt }, { generateGeminiImage }] = await Promise.all([
      import("@/lib/promptComposer"),
      import("@/lib/geminiImage"),
    ]);

    await runLimited(queued, GENERATION_CONCURRENCY, async (shot) => {
      setShots((prev) =>
        prev.map((s) =>
          s.id === shot.id
            ? { ...s, status: "rendering", progress: Math.max(s.progress ?? 0, 5), error: undefined }
            : s,
        ),
      );
      const progressTimer = startProgress(shot.id, 5);

      try {
        const preset =
          selectedStyleName && isPresetPose(shot.deckShot)
            ? findPreset(presets, selectedStyleName, shot.deckShot)
            : undefined;
        const presetContent = preset
          ? {
              styleName: preset.styleName,
              heading: preset.heading,
              subHeading: preset.subHeading,
              callouts: [preset.c1Text, preset.c2Text, preset.c3Text, preset.c4Text],
              calloutZones: [preset.c1Zone, preset.c2Zone, preset.c3Zone, preset.c4Zone],
            }
          : undefined;

        const promptData = composeDeckPrompt({
          shootType,
          pushupBraOnly: false,
          deckShot: shot.deckShot,
          brand,
          aspect,
          presetContent,
        });

        const imageUrl = await generateGeminiImage({
          apiKey,
          prompt: promptData.prompt,
          images,
          shootType,
          pushupBraOnly: false,
          deckShot: shot.deckShot,
          engine,
          aspect,
        });
        if (imageUrl.startsWith("blob:")) generatedUrls.current.push(imageUrl);

        setShots((prev) =>
          prev.map((s) =>
            s.id === shot.id ? { ...s, status: "done", progress: 100, imageUrl, presetContent } : s,
          ),
        );
      } catch (error) {
        setShots((prev) =>
          prev.map((s) =>
            s.id === shot.id
              ? {
                  ...s,
                  status: "error",
                  progress: s.progress ?? 0,
                  error: error instanceof Error ? error.message : "Image generation failed.",
                }
              : s,
          ),
        );
      } finally {
        clearInterval(progressTimer);
      }
    });

    setGenerating(false);
  }, [
    availableBrands,
    brandId,
    deck,
    aspect,
    shootType,
    images,
    engine,
    selectedStyleName,
    presets,
    onNeedAuth,
    onAuthUsed,
    startProgress,
  ]);

  // Once generation finishes, move from the progress bar to the "open" prompt.
  useEffect(() => {
    if (phase === "generating" && !generating && shots.length > 0) {
      setPhase("ready-to-open");
    }
  }, [phase, generating, shots.length]);

  const regenerateShot = useCallback(
    async (id: string, note: string) => {
      const brand = availableBrands.find((b) => b.id === brandId) ?? availableBrands[0];
      const apiKey = getGeminiApiKey();
      if (!brand || !auth.unlocked || !auth.hasGeminiKey || !apiKey) {
        onNeedAuth();
        return;
      }

      const shot = shots.find((s) => s.id === id);
      if (!shot) return;
      if (shot.imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(shot.imageUrl);
        generatedUrls.current = generatedUrls.current.filter((url) => url !== shot.imageUrl);
      }

      setShots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "rendering", progress: 5, userNote: note, error: undefined } : s,
        ),
      );
      const progressTimer = startProgress(id, 5);

      const [{ composeDeckPrompt }, { generateGeminiImage }] = await Promise.all([
        import("@/lib/promptComposer"),
        import("@/lib/geminiImage"),
      ]);

      try {
        const preset =
          selectedStyleName && isPresetPose(shot.deckShot)
            ? findPreset(presets, selectedStyleName, shot.deckShot)
            : undefined;
        const presetContent = preset
          ? {
              styleName: preset.styleName,
              heading: preset.heading,
              subHeading: preset.subHeading,
              callouts: [preset.c1Text, preset.c2Text, preset.c3Text, preset.c4Text],
              calloutZones: [preset.c1Zone, preset.c2Zone, preset.c3Zone, preset.c4Zone],
            }
          : undefined;

        const promptData = composeDeckPrompt({
          shootType: shot.shootType,
          pushupBraOnly: false,
          deckShot: shot.deckShot,
          brand,
          aspect: shot.aspect,
          userNote: note,
          presetContent,
        });

        const imageUrl = await generateGeminiImage({
          apiKey,
          prompt: promptData.prompt,
          images,
          shootType: shot.shootType,
          pushupBraOnly: false,
          deckShot: shot.deckShot,
          engine,
          aspect: shot.aspect,
        });
        if (imageUrl.startsWith("blob:")) generatedUrls.current.push(imageUrl);

        setShots((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, status: "done", progress: 100, userNote: note, imageUrl, presetContent }
              : s,
          ),
        );
        setPromptText(null);
      } catch (error) {
        setShots((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "error",
                  progress: s.progress ?? 0,
                  userNote: note,
                  error: error instanceof Error ? error.message : "Image generation failed.",
                }
              : s,
          ),
        );
      } finally {
        clearInterval(progressTimer);
      }
    },
    [availableBrands, brandId, auth, onNeedAuth, shots, images, engine, selectedStyleName, presets, startProgress],
  );

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
      if (!auth.unlocked || !auth.hasGeminiKey || !getGeminiApiKey()) {
        onNeedAuth();
        return;
      }
      playClose(() => {
        setPhase("generating");
        setGenerating(true);
        void generate();
      });
      return;
    }
    if (phase === "ready-to-open") {
      playSurgeOnce(() => setPhase("tilt-loop"));
      return;
    }
    if (phase === "tilt-loop") {
      playReopen(() => {
        setReviewIndex(0);
        setShowPrompt(false);
        setPromptText(null);
        setPhase("review");
      });
      return;
    }
    if (phase === "review") {
      const atLast = reviewIndex >= shots.length - 1;
      playFlip(() => {
        if (atLast) {
          setPhase("downloads");
        } else {
          setReviewIndex((i) => i + 1);
          setShowPrompt(false);
          setPromptText(null);
          setPhase("review");
        }
      });
    }
  }, [
    phase,
    primaryReady,
    needsFlip,
    pantyReady,
    brandId,
    auth,
    onNeedAuth,
    playFlip,
    playClose,
    playSurgeOnce,
    playReopen,
    generate,
    reviewIndex,
    shots.length,
  ]);

  const handleEscape = useCallback(() => {
    if (phase === "review" || phase === "downloads") {
      playClose(() => onClose());
      return;
    }
    onClose();
  }, [phase, playClose, onClose]);

  useBookInAppShortcuts({
    onEnter: handleEnter,
    onClose: handleEscape,
    enabled: true,
  });

  const styleMatches = useMemo(
    () => (styleSearch.trim() ? searchStylesByNumber(presets, styleSearch.trim()) : []),
    [presets, styleSearch],
  );

  const overallProgress = useMemo(() => {
    if (shots.length === 0) return 0;
    const total = shots.reduce((sum, s) => sum + (s.status === "done" ? 100 : (s.progress ?? 0)), 0);
    return Math.round(total / shots.length);
  }, [shots]);

  const currentShot: GeneratedShot | undefined = shots[reviewIndex];

  useEffect(() => {
    setRedoNote("");
  }, [reviewIndex]);

  useEffect(() => {
    if (!showPrompt || !currentShot || currentShot.status !== "done") return;
    let active = true;
    setPromptText(null);
    void import("@/lib/promptComposer").then(({ composeDeckPrompt }) => {
      if (!active) return;
      const brand = availableBrands.find((b) => b.id === currentShot.brandId) ?? availableBrands[0];
      if (!brand) return;
      const promptData = composeDeckPrompt({
        shootType: currentShot.shootType,
        pushupBraOnly: false,
        deckShot: currentShot.deckShot,
        brand,
        aspect: currentShot.aspect,
        userNote: currentShot.userNote,
        presetContent: currentShot.presetContent,
      });
      setPromptText(promptData.prompt);
    });
    return () => {
      active = false;
    };
  }, [showPrompt, currentShot, availableBrands]);

  const doneCount = shots.filter((s) => s.status === "done").length;

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

        {phase === "generating" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[#c83f65] transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-xs font-medium tracking-wide text-white/80">
              Generating your deck… {overallProgress}%
            </p>
          </div>
        ) : null}

        {phase === "ready-to-open" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/60 px-6 py-3 text-sm font-medium tracking-wide text-white">
              Press Enter to open the book
            </p>
          </div>
        ) : null}

        {phase === "tilt-loop" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-black/60 px-6 py-3 text-sm font-medium tracking-wide text-white">
              Press Enter to open the book
            </p>
          </div>
        ) : null}

        {phase === "review" && currentShot ? (
          <div className="absolute inset-0">
            {/* Left page — the generated image, or the prompt text in its place */}
            <div className="absolute left-[29%] top-[20%] flex h-[57%] w-[18%] items-center justify-center overflow-hidden">
              {showPrompt ? (
                <div className="h-full w-full overflow-y-auto rounded-lg bg-white/70 p-2 text-[9px] leading-snug text-[#444044]">
                  {promptText ?? "Loading prompt…"}
                </div>
              ) : currentShot.status === "done" && currentShot.imageUrl ? (
                <img
                  src={currentShot.imageUrl}
                  alt={DECK_SHOT_LABELS[currentShot.deckShot]}
                  className="h-full w-full rounded-lg object-cover shadow-md"
                />
              ) : currentShot.status === "error" ? (
                <p className="px-3 text-center text-[10px] font-medium text-red-700">
                  {currentShot.error ?? "Generation failed."}
                </p>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-[#8E173C]/60" />
              )}
            </div>

            {/* Right page — shot info + Save / Redo / Prompt controls */}
            <div className="absolute left-[53%] top-[20%] flex h-[57%] w-[18%] flex-col gap-3 overflow-y-auto px-1">
              <div>
                <PageHeading>
                  Image {reviewIndex + 1} of {shots.length}
                </PageHeading>
                <p className="text-center text-xs font-semibold text-[#8E173C]">
                  {DECK_SHOT_LABELS[currentShot.deckShot]}
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  disabled={currentShot.status !== "done"}
                  onClick={() => void downloadShot(currentShot)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2 py-1 text-[10px] font-medium text-[#8E173C] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3 w-3" />
                  Save
                </button>
                <button
                  type="button"
                  disabled={currentShot.status !== "done"}
                  onClick={() => setShowPrompt((v) => !v)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                    showPrompt
                      ? "border-transparent bg-[#8E173C] text-white"
                      : "border-[#8E173C]/30 bg-[#FFF8F2]/70 text-[#8E173C]",
                  )}
                >
                  <Clipboard className="h-3 w-3" />
                  Prompt
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <textarea
                  value={redoNote}
                  onChange={(e) => setRedoNote(e.target.value)}
                  disabled={currentShot.status === "rendering"}
                  placeholder="What should change? (optional)"
                  className="min-h-14 w-full resize-none rounded-lg border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2 py-1.5 text-[10px] text-[#444044] outline-none placeholder:text-[#444044]/50 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <button
                  type="button"
                  disabled={currentShot.status === "rendering"}
                  onClick={() => void regenerateShot(currentShot.id, redoNote)}
                  className="flex items-center justify-center gap-1 rounded-full border border-[#8E173C]/30 bg-[#FFF8F2]/70 px-2 py-1 text-[10px] font-medium text-[#8E173C] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {currentShot.status === "rendering" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Redo this shot
                </button>
              </div>
            </div>

            <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-xs font-medium tracking-wide text-white/70">
              {reviewIndex >= shots.length - 1 ? "Press Enter to finish" : "Press Enter for next image"}
            </p>
          </div>
        ) : null}

        {phase === "downloads" ? (
          <div className="absolute inset-0">
            <div className="absolute left-[29%] top-[20%] flex h-[57%] w-[18%] flex-col items-center justify-center gap-2 text-center">
              <Check className="h-8 w-8 text-[#8E173C]" />
              <p className="text-sm font-semibold text-[#8E173C]">
                {doneCount} of {shots.length} images ready
              </p>
              <p className="text-[10px] text-[#444044]">Your shoot is complete.</p>
            </div>

            <div className="absolute left-[53%] top-[20%] flex h-[57%] w-[18%] flex-col gap-1.5 overflow-y-auto px-1">
              <PageHeading>Download</PageHeading>
              <button
                type="button"
                disabled={doneCount === 0}
                onClick={() => void downloadShotsZip(shots)}
                className="flex items-center justify-center gap-1.5 rounded-full bg-[#8E173C] px-3 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Download all (.zip)
              </button>
              <div className="mt-2 flex flex-col gap-1">
                {shots.map((shot) => (
                  <button
                    key={shot.id}
                    type="button"
                    disabled={shot.status !== "done"}
                    onClick={() => void downloadShot(shot)}
                    className="flex items-center justify-between gap-1.5 rounded-full border border-[#8E173C]/25 bg-[#FFF8F2]/60 px-2.5 py-1 text-[10px] font-medium text-[#8E173C] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {DECK_SHOT_LABELS[shot.deckShot]}
                    <Download className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>

            <p className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-xs font-medium tracking-wide text-white/70">
              Press Escape to exit
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
