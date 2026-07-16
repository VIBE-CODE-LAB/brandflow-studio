import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nextFrame, runLimited } from "@/lib/concurrency";
import { useTilt } from "@/lib/useTilt";
import { getGeminiApiKey, incrementStudioUsage, type StudioAuthState } from "@/lib/studioAuth";
import {
  type AspectId,
  type Brand,
  type DeckType,
  type EngineId,
  type GeneratedShot,
  type ShootType,
  type SlotKey,
  allowedDecks,
  defaultDeck,
  requiredSlots,
} from "@/lib/studio";
import { type BraDeck, MAX_BRA_IMAGES, braDeckProgress, braDeckStatus, buildBraDecks } from "@/lib/gear2";
import { useGear2InAppShortcuts } from "@/lib/gear2Shortcuts";
import { ThemeSettings, type ThemeMode } from "@/components/studio/ThemeSettings";
import type { ImageMap } from "@/components/studio/UploadTray";
import { GhostIntro } from "@/components/gear2/GhostIntro";
import { CircularBraDeck } from "@/components/gear2/CircularBraDeck";
import { TwinCardStep } from "@/components/gear2/TwinCardStep";
import { FreeControlsStep } from "@/components/gear2/FreeControlsStep";
import { BraDeckDetailView } from "@/components/gear2/BraDeckDetailView";
import { RegenerateTray } from "@/components/gear2/RegenerateTray";

const GENERATION_CONCURRENCY = 5;
const BRA_ADVANCE_DELAY = 1200;
const TWIN_ADVANCE_DELAY = 700;

type Phase = "intro" | "bras" | "twin" | "controls" | "engine";

function findBrand(id: string | null, brands: Brand[]): Brand {
  return brands.find((b) => b.id === id) ?? brands[0];
}

interface Gear2ViewProps {
  onClose: () => void;
  auth: StudioAuthState;
  onNeedAuth: () => void;
  onAuthUsed: (used: number) => void;
  availableBrands: Brand[];
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onOpenAddBrand: () => void;
}

function StepShell({
  onBack,
  onForward,
  children,
}: {
  onBack: () => void;
  onForward?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="gear2-slide-in flex min-h-full flex-col items-center justify-center gap-6 px-6 py-8">
      <div className="w-full max-w-3xl">{children}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-white/30 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {onForward ? (
          <button
            type="button"
            onClick={onForward}
            className="flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-white/30 hover:text-white"
          >
            Next
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Gear2View({
  onClose,
  auth,
  onNeedAuth,
  onAuthUsed,
  availableBrands,
  themeMode,
  onThemeChange,
  onOpenAddBrand,
}: Gear2ViewProps) {
  const [closing, setClosing] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [shootType, setShootType] = useState<ShootType>("bra_panty");
  const [pushupBraOnly, setPushupBraOnly] = useState(false);
  const [deckType, setDeckType] = useState<DeckType>("deck_5");
  const [baseImages, setBaseImages] = useState<ImageMap>({});
  const [braImages, setBraImages] = useState<string[]>([]);
  const [brandId, setBrandId] = useState<string | null>(availableBrands[0]?.id ?? null);
  const [aspect, setAspect] = useState<AspectId>("3:4");
  const [engine, setEngine] = useState<EngineId>("fast");
  const [note] = useState("");
  const [braDecks, setBraDecks] = useState<BraDeck[]>([]);
  const [generating, setGenerating] = useState(false);
  const [openDeckId, setOpenDeckId] = useState<string | null>(null);
  const [selectedForRegen, setSelectedForRegen] = useState<string[]>([]);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);

  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const generatedUrls = useRef<string[]>([]);
  const braAdvanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const twinAdvanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const slots = useMemo(
    () => requiredSlots(shootType, pushupBraOnly).filter((s) => s !== "bra"),
    [shootType, pushupBraOnly],
  );
  const validDecks = allowedDecks(shootType);
  const missingPhotos = slots.filter((s) => !baseImages[s]);
  const setupReady = missingPhotos.length === 0 && braImages.length > 0 && Boolean(brandId);
  const ready = setupReady && !generating;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    if (phase !== "bras" || braImages.length === 0) return;
    clearTimeout(braAdvanceTimer.current);
    braAdvanceTimer.current = setTimeout(() => setPhase("twin"), BRA_ADVANCE_DELAY);
    return () => clearTimeout(braAdvanceTimer.current);
  }, [braImages, phase]);

  useEffect(() => {
    if (phase !== "twin" || missingPhotos.length > 0) return;
    clearTimeout(twinAdvanceTimer.current);
    twinAdvanceTimer.current = setTimeout(() => setPhase("controls"), TWIN_ADVANCE_DELAY);
    return () => clearTimeout(twinAdvanceTimer.current);
  }, [missingPhotos.length, phase]);

  const changeShootType = useCallback((next: ShootType) => {
    setShootType(next);
    setPushupBraOnly(false);
    setDeckType(defaultDeck(next));
    setBaseImages((prev) => {
      const keep = requiredSlots(next, false).filter((s) => s !== "bra") as SlotKey[];
      const cleaned: ImageMap = {};
      for (const k of Object.keys(prev)) {
        const base = k.replace(/Back$/, "");
        if (keep.includes(base as SlotKey)) cleaned[k] = prev[k];
      }
      return cleaned;
    });
  }, []);

  const changeDeck = useCallback(
    (next: DeckType) => {
      if (!validDecks.includes(next)) return;
      setDeckType(next);
    },
    [validDecks],
  );

  const setBaseImage = useCallback((key: string, value: string | null) => {
    setBaseImages((prev) => ({ ...prev, [key]: value ?? undefined }));
  }, []);

  const addBraImages = useCallback((dataUrls: string[]) => {
    setBraImages((prev) => [...prev, ...dataUrls].slice(0, MAX_BRA_IMAGES));
  }, []);
  const removeBraImage = useCallback((index: number) => {
    setBraImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  const rememberGeneratedUrl = (url: string) => {
    if (url.startsWith("blob:")) generatedUrls.current.push(url);
    return url;
  };

  const revokeGeneratedUrl = (url: string | undefined) => {
    if (!url?.startsWith("blob:")) return;
    URL.revokeObjectURL(url);
    generatedUrls.current = generatedUrls.current.filter((item) => item !== url);
  };

  const clearGeneratedUrls = () => {
    generatedUrls.current.forEach((url) => URL.revokeObjectURL(url));
    generatedUrls.current = [];
  };

  useEffect(() => {
    return () => {
      clearTimers();
      clearGeneratedUrls();
    };
  }, []);

  const updateShot = useCallback((shotId: string, updater: (s: GeneratedShot) => GeneratedShot) => {
    setBraDecks((prev) =>
      prev.map((deck) =>
        deck.shots.some((s) => s.id === shotId)
          ? { ...deck, shots: deck.shots.map((s) => (s.id === shotId ? updater(s) : s)) }
          : deck,
      ),
    );
  }, []);

  const startProgress = useCallback(
    (shotId: string, start = 3) => {
      updateShot(shotId, (s) => ({ ...s, progress: Math.max(s.progress ?? 0, start) }));
      const timer = setInterval(() => {
        updateShot(shotId, (s) => {
          if (s.status !== "rendering") return s;
          const current = s.progress ?? start;
          const step = current < 50 ? 4 : current < 80 ? 2 : 1;
          return { ...s, progress: Math.min(92, current + step) };
        });
      }, 900);
      timers.current.push(timer);
      return timer;
    },
    [updateShot],
  );

  const generateAll = useCallback(async () => {
    if (!setupReady || !brandId || generating) return;
    if (!auth.unlocked || !auth.hasGeminiKey) {
      onNeedAuth();
      return;
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      onNeedAuth();
      return;
    }

    clearTimers();
    clearGeneratedUrls();
    const used = incrementStudioUsage();
    onAuthUsed(used);

    const brand = findBrand(brandId, availableBrands);
    const decks = buildBraDecks({ braImages, deckType, aspect, brand, shootType, pushupBraOnly, note });
    setBraDecks(decks);
    setSelectedForRegen([]);
    setOpenDeckId(null);
    setPhase("engine");
    setGenerating(true);
    await nextFrame();

    const [{ composeDeckPrompt }, { generateGeminiImage }] = await Promise.all([
      import("@/lib/promptComposer"),
      import("@/lib/geminiImage"),
    ]);
    await nextFrame();

    const jobs = decks.flatMap((deck) => deck.shots.map((shot) => ({ deck, shot })));

    await runLimited(jobs, GENERATION_CONCURRENCY, async ({ deck, shot }) => {
      updateShot(shot.id, (s) => ({ ...s, status: "rendering", progress: Math.max(s.progress ?? 0, 5), error: undefined }));
      const progressTimer = startProgress(shot.id, 5);

      try {
        const promptData = composeDeckPrompt({
          shootType: shot.shootType,
          pushupBraOnly: shot.pushupBraOnly,
          deckShot: shot.deckShot,
          brand,
          aspect: shot.aspect,
          userNote: shot.userNote,
        });

        const imageUrl = rememberGeneratedUrl(
          await generateGeminiImage({
            apiKey,
            prompt: promptData.prompt,
            images: { ...baseImages, bra: deck.braImage },
            shootType: shot.shootType,
            pushupBraOnly: shot.pushupBraOnly,
            deckShot: shot.deckShot,
            engine,
            aspect: shot.aspect,
          }),
        );

        updateShot(shot.id, (s) => ({ ...s, status: "done", progress: 100, imageUrl }));
      } catch (error) {
        updateShot(shot.id, (s) => ({
          ...s,
          status: "error",
          progress: s.progress ?? 0,
          error: error instanceof Error ? error.message : "Image generation failed.",
        }));
      } finally {
        clearInterval(progressTimer);
      }
    });

    setGenerating(false);
  }, [
    setupReady,
    brandId,
    generating,
    auth.unlocked,
    auth.hasGeminiKey,
    onNeedAuth,
    onAuthUsed,
    availableBrands,
    braImages,
    deckType,
    aspect,
    shootType,
    pushupBraOnly,
    note,
    baseImages,
    engine,
    updateShot,
    startProgress,
  ]);

  const regenerateBraShot = useCallback(
    async (braId: string, shotId: string, redoNote: string) => {
      if (!auth.unlocked || !auth.hasGeminiKey) {
        onNeedAuth();
        return;
      }
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        onNeedAuth();
        return;
      }

      const deck = braDecks.find((d) => d.id === braId);
      const shot = deck?.shots.find((s) => s.id === shotId);
      if (!deck || !shot) return;
      revokeGeneratedUrl(shot.imageUrl);

      updateShot(shotId, (s) => ({ ...s, status: "rendering", progress: 5, userNote: redoNote, error: undefined }));
      const progressTimer = startProgress(shotId, 5);

      const [{ composeDeckPrompt }, { generateGeminiImage }] = await Promise.all([
        import("@/lib/promptComposer"),
        import("@/lib/geminiImage"),
      ]);

      try {
        const brand = findBrand(shot.brandId, availableBrands);
        const promptData = composeDeckPrompt({
          shootType: shot.shootType,
          pushupBraOnly: shot.pushupBraOnly,
          deckShot: shot.deckShot,
          brand,
          aspect: shot.aspect,
          userNote: shot.userNote,
          regenerationNote: redoNote,
        });

        const imageUrl = rememberGeneratedUrl(
          await generateGeminiImage({
            apiKey,
            prompt: promptData.prompt,
            images: { ...baseImages, bra: deck.braImage },
            shootType: shot.shootType,
            pushupBraOnly: shot.pushupBraOnly,
            deckShot: shot.deckShot,
            engine,
            aspect: shot.aspect,
          }),
        );

        updateShot(shotId, (s) => ({ ...s, status: "done", progress: 100, userNote: redoNote, imageUrl }));
      } catch (error) {
        updateShot(shotId, (s) => ({
          ...s,
          status: "error",
          progress: s.progress ?? 0,
          userNote: redoNote,
          error: error instanceof Error ? error.message : "Image generation failed.",
        }));
      } finally {
        clearInterval(progressTimer);
      }
    },
    [auth.unlocked, auth.hasGeminiKey, onNeedAuth, braDecks, availableBrands, baseImages, engine, updateShot, startProgress],
  );

  const toggleSelectForRegen = useCallback((shotId: string) => {
    setSelectedForRegen((prev) => (prev.includes(shotId) ? prev.filter((id) => id !== shotId) : [...prev, shotId]));
  }, []);
  const removeFromSelection = useCallback((shotId: string) => {
    setSelectedForRegen((prev) => prev.filter((id) => id !== shotId));
  }, []);
  const clearSelection = useCallback(() => setSelectedForRegen([]), []);

  const selectedShots = useMemo(() => {
    const all = braDecks.flatMap((d) => d.shots);
    return selectedForRegen.map((id) => all.find((s) => s.id === id)).filter((s): s is GeneratedShot => Boolean(s));
  }, [braDecks, selectedForRegen]);

  const openDeckByIndex = useCallback(
    (index: number) => {
      const deck = braDecks[index];
      if (deck && braDeckStatus(deck) === "done") setOpenDeckId(deck.id);
    },
    [braDecks],
  );
  const closeDeck = useCallback(() => setOpenDeckId(null), []);

  useGear2InAppShortcuts({
    onClose: handleClose,
    onGenerate: () => void generateAll(),
    canGenerate: ready,
    isControlsPhase: phase === "controls",
    isEngineGrid: phase === "engine" && openDeckId === null,
    isEngineDeck: phase === "engine" && openDeckId !== null,
    onOpenDeckByNumber: openDeckByIndex,
    onCloseDeck: closeDeck,
    anyDialogOpen: regenDialogOpen,
  });

  const generateLabel = generating
    ? "Generating decks..."
    : `Generate ${braImages.length || 0} bra deck${braImages.length === 1 ? "" : "s"}`;

  const doneDecks = braDecks.filter((d) => braDeckStatus(d) === "done").length;
  const openDeck = braDecks.find((d) => d.id === openDeckId) ?? null;
  const openDeckIndex = openDeck ? braDecks.indexOf(openDeck) : -1;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#050608] text-white transition-opacity duration-200",
        closing ? "opacity-0" : "opacity-100",
      )}
    >
      {phase === "intro" ? (
        <GhostIntro onDone={() => setPhase("bras")} />
      ) : (
        <>
          <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5">
            <div className="ghost-loader" aria-hidden />
            <div className="flex items-center gap-3">
              <ThemeSettings mode={themeMode} onChange={onThemeChange} onAddBrand={onOpenAddBrand} />
              <Button variant="ghost" size="sm" className="h-8 rounded-full text-white/60 hover:text-white" onClick={handleClose}>
                Exit (Backspace)
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto pb-24">
            {phase === "bras" && (
              <StepShell onBack={handleClose} onForward={braImages.length > 0 ? () => setPhase("twin") : undefined}>
                <CircularBraDeck images={braImages} onAdd={addBraImages} onRemove={removeBraImage} />
              </StepShell>
            )}

            {phase === "twin" && (
              <StepShell onBack={() => setPhase("bras")} onForward={missingPhotos.length === 0 ? () => setPhase("controls") : undefined}>
                <TwinCardStep
                  shootType={shootType}
                  pushupBraOnly={pushupBraOnly}
                  images={baseImages}
                  onShootTypeChange={changeShootType}
                  onImageChange={setBaseImage}
                />
              </StepShell>
            )}

            {phase === "controls" && (
              <StepShell onBack={() => setPhase("twin")}>
                <FreeControlsStep
                  deckType={deckType}
                  validDecks={validDecks}
                  onDeckType={changeDeck}
                  brandId={brandId}
                  brands={availableBrands}
                  onBrand={setBrandId}
                  aspect={aspect}
                  onAspect={setAspect}
                  engine={engine}
                  onEngine={setEngine}
                  ready={ready}
                  generating={generating}
                  label={generateLabel}
                  onGenerate={() => void generateAll()}
                />
              </StepShell>
            )}

            {phase === "engine" && openDeck ? (
              <div className="px-5 py-6">
                <BraDeckDetailView
                  deck={openDeck}
                  index={openDeckIndex}
                  selectedForRegen={selectedForRegen}
                  onToggleSelect={toggleSelectForRegen}
                  onBack={closeDeck}
                />
              </div>
            ) : null}

            {phase === "engine" && !openDeck ? (
              <div className="space-y-4 px-5 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/40">Bra decks</p>
                    <h2 className="text-xl">
                      {doneDecks}/{braDecks.length} decks ready
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
                  {braDecks.map((deck, index) => (
                    <DeckTile key={deck.id} deck={deck} index={index} onOpen={() => setOpenDeckId(deck.id)} />
                  ))}
                </div>
              </div>
            ) : null}
          </main>

          {phase === "engine" ? (
            <RegenerateTray
              shots={selectedShots}
              onRemove={removeFromSelection}
              onRegenerate={(braId, shotId, redoNote) => void regenerateBraShot(braId, shotId, redoNote)}
              onClear={clearSelection}
              dialogOpen={regenDialogOpen}
              onDialogOpenChange={setRegenDialogOpen}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function DeckTile({ deck, index, onOpen }: { deck: BraDeck; index: number; onOpen: () => void }) {
  const status = braDeckStatus(deck);
  const progress = braDeckProgress(deck);
  const tilt = useTilt({ max: 8, scale: 1.05 });

  return (
    <button
      type="button"
      disabled={status !== "done"}
      onClick={onOpen}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      style={tilt.style}
      className={cn(
        "gear2-tile group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg shadow-black/40",
        status === "done" ? "cursor-pointer hover:border-white/40" : "cursor-default",
      )}
    >
      <img src={deck.braImage} alt={`Bra ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-semibold text-white shadow-sm">
        {index < 9 ? index + 1 : index === 9 ? 0 : ""} · Bra {index + 1}
      </div>
      <div className="absolute inset-x-2.5 bottom-2.5 space-y-1.5">
        <p className="text-xs font-semibold text-white">
          {status === "done"
            ? "Ready · tap to review"
            : status === "error"
              ? "Some shots failed"
              : `Generating · ${progress}%`}
        </p>
        {status !== "done" ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="gear2-tile-progress h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
    </button>
  );
}
