import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { nextFrame, runLimited } from "@/lib/concurrency";
import { getGeminiApiKey, incrementStudioUsage, type StudioAuthState } from "@/lib/studioAuth";
import {
  DECKS,
  SHOOT_TYPES,
  type AspectId,
  type Brand,
  type DeckType,
  type EngineId,
  type GeneratedShot,
  type ShootType,
  type SlotKey,
  allowedDecks,
  defaultDeck,
  getDeck,
  requiredSlots,
} from "@/lib/studio";
import { type BraDeck, MAX_BRA_IMAGES, braDeckProgress, braDeckStatus, buildBraDecks } from "@/lib/gear2";
import { BrandPicker } from "@/components/studio/BrandPicker";
import { RefinePanel } from "@/components/studio/RefinePanel";
import { Stage, downloadShotsZip } from "@/components/studio/Stage";
import { ThemeSettings, type ThemeMode } from "@/components/studio/ThemeSettings";
import { UploadTray, type ImageMap } from "@/components/studio/UploadTray";
import { BraDeckDropzone } from "@/components/gear2/BraDeckDropzone";
import { GhostLoader } from "@/components/gear2/GhostLoader";

const GENERATION_CONCURRENCY = 5;

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
  const [phase, setPhase] = useState<"setup" | "engine">("setup");
  const [shootType, setShootType] = useState<ShootType>("bra_panty");
  const [pushupBraOnly, setPushupBraOnly] = useState(false);
  const [deckType, setDeckType] = useState<DeckType>("deck_5");
  const [baseImages, setBaseImages] = useState<ImageMap>({});
  const [braImages, setBraImages] = useState<string[]>([]);
  const [brandId, setBrandId] = useState<string | null>(availableBrands[0]?.id ?? null);
  const [aspect, setAspect] = useState<AspectId>("3:4");
  const [engine, setEngine] = useState<EngineId>("fast");
  const [note, setNote] = useState("");
  const [braDecks, setBraDecks] = useState<BraDeck[]>([]);
  const [generating, setGenerating] = useState(false);
  const [openDeckId, setOpenDeckId] = useState<string | null>(null);

  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const generatedUrls = useRef<string[]>([]);

  const slots = useMemo(
    () => requiredSlots(shootType, pushupBraOnly).filter((s) => s !== "bra"),
    [shootType, pushupBraOnly],
  );
  const activeDeck = getDeck(deckType);
  const validDecks = allowedDecks(shootType);
  const needsBack = activeDeck.shots.includes("back");
  const missingPhotos = slots.filter((s) => !baseImages[s]);
  const setupReady = missingPhotos.length === 0 && braImages.length > 0 && Boolean(brandId);
  const ready = setupReady && !generating;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

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

  const togglePushupBraOnly = useCallback(() => {
    setPushupBraOnly((v) => {
      const next = !v;
      if (next) setBaseImages((prev) => ({ ...prev, panty: undefined, pantyBack: undefined }));
      return next;
    });
  }, []);

  const setBaseImage = useCallback((key: string, value: string | null) => {
    setBaseImages((prev) => ({ ...prev, [key]: value ?? undefined }));
  }, []);

  const addBraImages = useCallback((dataUrls: string[]) => {
    setBraImages((prev) => [...prev, ...dataUrls].slice(0, MAX_BRA_IMAGES));
  }, []);
  const removeBraImage = useCallback((index: number) => {
    setBraImages((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const clearBraImages = useCallback(() => setBraImages([]), []);

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

  const generateLabel = generating
    ? "Generating Decks..."
    : missingPhotos.length > 0
      ? `Add ${missingPhotos.join(" + ")} to start`
      : braImages.length === 0
        ? "Drop bra photos to start"
        : !brandId
          ? "Choose a brand"
          : !auth.unlocked
            ? "Login to generate decks"
            : `Generate ${braImages.length} Bra Deck${braImages.length === 1 ? "" : "s"}`;

  const doneDecks = braDecks.filter((d) => braDeckStatus(d) === "done").length;
  const openDeck = braDecks.find((d) => d.id === openDeckId) ?? null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background transition-opacity duration-200",
        closing ? "opacity-0" : "opacity-100",
      )}
    >
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <GhostLoader size="sm" />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">Gear 2 · Bra Batch</p>
              <p className="text-[0.7rem] text-muted-foreground">one model · many bras · full decks</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSettings mode={themeMode} onChange={onThemeChange} onAddBrand={onOpenAddBrand} />
            <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={handleClose}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Studio Flow
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6">
        {phase === "setup" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(380px,440px)_1fr]">
            <div className="panel space-y-6 p-5">
              <section>
                <StepHead index={1} title="What are we shooting?" hint="Sets required photos" />
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {SHOOT_TYPES.map((t) => {
                    const active = shootType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => changeShootType(t.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all",
                          active
                            ? "border-transparent text-primary-foreground shadow-md"
                            : "border-border bg-paper hover:border-primary/50",
                        )}
                        style={active ? { background: t.tint } : undefined}
                      >
                        <span className="text-xs font-semibold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                {shootType === "pushup" && (
                  <label className="mt-2.5 flex cursor-pointer items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pushupBraOnly}
                      onChange={togglePushupBraOnly}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-foreground">Pushup bra-only</span>
                    <span className="text-xs text-muted-foreground">drops the panty slot</span>
                  </label>
                )}
              </section>

              <div className="hairline" />

              <section>
                <StepHead index={2} title="Deck size" hint={activeDeck.hint} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DECKS.map((item) => {
                    const active = deckType === item.id;
                    const disabled = !validDecks.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => changeDeck(item.id)}
                        className={cn(
                          "rounded-2xl border px-3 py-3 text-left transition-all",
                          active
                            ? "border-primary bg-primary/10 text-foreground shadow-sm"
                            : "border-border bg-paper hover:border-primary/50",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="mt-1 block text-[0.68rem] leading-snug text-muted-foreground">
                          {item.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Every bra gets its own {activeDeck.shots.length}-image deck against the same model.
                </p>
              </section>

              <div className="hairline" />

              <section>
                <StepHead
                  index={3}
                  title="Drop model photos"
                  hint={`${slots.length - missingPhotos.length}/${slots.length} added`}
                />
                <div className="mt-3">
                  <UploadTray
                    shootType={shootType}
                    pushupBraOnly={pushupBraOnly}
                    images={baseImages}
                    onChange={setBaseImage}
                    needsBack={needsBack}
                    slotsOverride={slots}
                  />
                </div>
              </section>

              <div className="hairline" />

              <section>
                <StepHead index={4} title="Drop your bras" hint={`up to ${MAX_BRA_IMAGES}`} />
                <div className="mt-3">
                  <BraDeckDropzone
                    images={braImages}
                    onAdd={addBraImages}
                    onRemove={removeBraImage}
                    onClear={clearBraImages}
                  />
                </div>
              </section>

              <div className="hairline" />

              <section>
                <StepHead index={5} title="Brand & look" hint="Applied to every bra deck" />
                <div className="mt-3 space-y-3">
                  <BrandPicker value={brandId} onChange={setBrandId} brands={availableBrands} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {activeDeck.hint}
                    </p>
                    <RefinePanel aspect={aspect} engine={engine} note={note} onAspect={setAspect} onEngine={setEngine} onNote={setNote} />
                  </div>
                </div>
              </section>

              <Button variant="hero" size="xl" className="w-full rounded-2xl" disabled={!ready} onClick={() => void generateAll()}>
                {generating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
                {generateLabel}
              </Button>
            </div>

            <div className="panel flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
              <GhostLoader size="lg" className="mb-4" />
              <h2 className="text-2xl">Your bra decks land here</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Drop the model once, drop up to {MAX_BRA_IMAGES} bras, pick a deck size and brand, then
                generate — every bra gets its own full deck to review.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Bra decks</p>
                <h2 className="text-xl">
                  {doneDecks}/{braDecks.length} decks ready
                </h2>
              </div>
              <Button variant="soft" size="sm" className="rounded-full" onClick={() => setPhase("setup")} disabled={generating}>
                Back to setup
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {braDecks.map((deck, index) => {
                const status = braDeckStatus(deck);
                const progress = braDeckProgress(deck);
                return (
                  <button
                    key={deck.id}
                    type="button"
                    disabled={status !== "done"}
                    onClick={() => setOpenDeckId(deck.id)}
                    className={cn(
                      "group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border text-left transition-all",
                      status === "done" ? "cursor-pointer hover:border-primary/60" : "cursor-default",
                    )}
                  >
                    <img src={deck.braImage} alt={`Bra ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <div className="absolute left-2.5 top-2.5 rounded-full bg-paper/85 px-2.5 py-1 text-[0.68rem] font-semibold text-foreground shadow-sm">
                      Bra {index + 1}
                    </div>
                    <div className="absolute inset-x-2.5 bottom-2.5 space-y-1.5">
                      <p className="text-xs font-semibold text-paper">
                        {status === "done"
                          ? "Ready · tap to review"
                          : status === "error"
                            ? "Some shots failed"
                            : `Generating · ${progress}%`}
                      </p>
                      {status !== "done" ? (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper/30">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <Dialog open={openDeck !== null} onOpenChange={(open) => !open && setOpenDeckId(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bra deck review</DialogTitle>
          </DialogHeader>
          {openDeck ? (
            <div className="min-h-[420px]">
              <Stage
                shots={openDeck.shots}
                shootType={shootType}
                pushupBraOnly={pushupBraOnly}
                generating={generating}
                onRegenerate={(id, redoNote) => void regenerateBraShot(openDeck.id, id, redoNote)}
                onDownloadAll={() => void downloadShotsZip(openDeck.shots.filter((s) => s.status === "done"))}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepHead({ index, title, hint }: { index: number; title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="step-index">{index}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}
