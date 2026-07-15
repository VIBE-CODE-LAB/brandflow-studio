import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, LogOut, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImageMap } from "@/components/studio/UploadTray";
import {
  DECKS,
  SHOOT_TYPES,
  type AspectId,
  type DeckType,
  type EngineId,
  type GeneratedShot,
  type ShootType,
  allowedDecks,
  brandLocked,
  defaultDeck,
  getBrand,
  getDeck,
  requiredSlots,
} from "@/lib/studio";
import {
  emptyAuth,
  getStudioAuth,
  incrementStudioUsage,
  loadStudioUsage,
  logoutStudio,
  type StudioAuthState,
} from "@/lib/studioAuth";

export const Route = createFileRoute("/")({
  component: StudioFlow,
});

const AuthDialog = lazy(() =>
  import("@/components/studio/AuthDialog").then((module) => ({ default: module.AuthDialog })),
);
const UploadTray = lazy(() =>
  import("@/components/studio/UploadTray").then((module) => ({ default: module.UploadTray })),
);
const BrandPicker = lazy(() =>
  import("@/components/studio/BrandPicker").then((module) => ({ default: module.BrandPicker })),
);
const RefinePanel = lazy(() =>
  import("@/components/studio/RefinePanel").then((module) => ({ default: module.RefinePanel })),
);
const Stage = lazy(() =>
  import("@/components/studio/Stage").then((module) => ({ default: module.Stage })),
);

let shotCounter = 0;
const nextId = () => `shot-${Date.now()}-${shotCounter++}`;

export function StudioFlow() {
  const [auth, setAuth] = useState<StudioAuthState>(emptyAuth);
  const [authOpen, setAuthOpen] = useState(false);
  const [shootType, setShootType] = useState<ShootType>("bra_panty");
  const [pushupBraOnly, setPushupBraOnly] = useState(false);
  const [images, setImages] = useState<ImageMap>({});
  const [brandId, setBrandId] = useState<string | null>("tweens");
  const [deck, setDeck] = useState<DeckType>("deck_5");
  const [aspect, setAspect] = useState<AspectId>("3:4");
  const [engine, setEngine] = useState<EngineId>("fast");
  const [note, setNote] = useState("");
  const [shots, setShots] = useState<GeneratedShot[]>([]);
  const [generating, setGenerating] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    void getStudioAuth()
      .then((serverAuth) => {
        setAuth({
          ...serverAuth,
          used: loadStudioUsage(),
        });
      })
      .catch(() => {
        setAuth({
          ...emptyAuth,
          used: loadStudioUsage(),
        });
      });
  }, []);

  const slots = requiredSlots(shootType, pushupBraOnly);
  const activeDeck = getDeck(deck);
  const validDecks = allowedDecks(shootType);
  const needsBack = activeDeck.shots.includes("back");
  const locked = brandLocked(shootType);

  const missingPhotos = slots.filter((s) => !images[s]);
  const setupReady = missingPhotos.length === 0 && activeDeck.shots.length > 0 && Boolean(brandId);
  const ready = setupReady && !generating;

  const changeShootType = useCallback((next: ShootType) => {
    setShootType(next);
    setPushupBraOnly(false);
    setDeck(defaultDeck(next));
    // prune images that this shoot type no longer uses
    setImages((prev) => {
      const keep = requiredSlots(next, false);
      const cleaned: ImageMap = {};
      for (const k of Object.keys(prev)) {
        const base = k.replace(/Back$/, "");
        if (keep.includes(base as never)) cleaned[k] = prev[k];
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

  const togglePushupBraOnly = useCallback(() => {
    setPushupBraOnly((v) => {
      const next = !v;
      if (next) setImages((prev) => ({ ...prev, panty: undefined, pantyBack: undefined }));
      return next;
    });
  }, []);

  const setImage = useCallback((key: string, value: string | null) => {
    setImages((prev) => ({ ...prev, [key]: value ?? undefined }));
  }, []);

  const orderedDeckShots = useMemo(() => activeDeck.shots, [activeDeck]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const generate = useCallback(() => {
    if (!setupReady || !brandId || generating) return;
    if (!auth.unlocked || !auth.hasGeminiKey) {
      setAuthOpen(true);
      return;
    }

    clearTimers();
    const used = incrementStudioUsage();
    setAuth((prev) => ({ ...prev, used }));
    const brand = getBrand(brandId);
    const queued: GeneratedShot[] = orderedDeckShots.map((deckShot) => ({
      id: nextId(),
      deckShot,
      aspect,
      brandId: brand.id,
      shootType,
      pushupBraOnly,
      status: "queued",
      userNote: note,
    }));
    setShots(queued);
    setGenerating(true);

    queued.forEach((shot, i) => {
      timers.current.push(
        setTimeout(() => {
          setShots((prev) =>
            prev.map((s) => (s.id === shot.id ? { ...s, status: "rendering" } : s)),
          );
        }, i * 900 + 150),
      );
      timers.current.push(
        setTimeout(
          () => {
            setShots((prev) => prev.map((s) => (s.id === shot.id ? { ...s, status: "done" } : s)));
            if (i === queued.length - 1) setGenerating(false);
          },
          i * 900 + 900,
        ),
      );
    });
  }, [
    setupReady,
    brandId,
    generating,
    auth.unlocked,
    auth.hasGeminiKey,
    orderedDeckShots,
    shootType,
    pushupBraOnly,
    aspect,
    note,
  ]);

  const regenerate = useCallback((id: string, redoNote: string) => {
    if (!auth.unlocked || !auth.hasGeminiKey) {
      setAuthOpen(true);
      return;
    }

    setShots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rendering", note: redoNote } : s)),
    );
    timers.current.push(
      setTimeout(() => {
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, status: "done" } : s)));
      }, 900),
    );
  }, [auth.unlocked, auth.hasGeminiKey]);

  const logout = useCallback(async () => {
    try {
      const loggedOut = await logoutStudio();
      setAuth({
        ...loggedOut,
        used: loadStudioUsage(),
      });
    } catch {
      setAuth({
        ...emptyAuth,
        used: loadStudioUsage(),
      });
    }
    setAuthOpen(false);
  }, []);

  const generateLabel = generating
    ? "Generating Deck..."
    : missingPhotos.length > 0
      ? `Add ${missingPhotos.join(" + ")} to start`
      : !brandId
        ? "Choose a brand"
        : !auth.unlocked
          ? "Login to generate deck"
        : `Generate ${activeDeck.shots.length} Image Deck`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Camera className="h-4.5 w-4.5" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">Studio Flow</p>
              <p className="text-[0.7rem] text-muted-foreground">one canvas · one tap · full set</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className={cn("h-1.5 w-1.5 rounded-full", auth.unlocked ? "bg-success" : "bg-muted-foreground")} />
              Free plan · {auth.used}/3 used
            </span>
            {auth.unlocked ? (
              <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={logout}>
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-[minmax(380px,440px)_1fr]">
        {/* Setup column */}
        <div className="panel space-y-6 p-5">
          {/* Step 1 — shoot type */}
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
                    <span className={cn("text-[0.62rem]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {requiredSlots(t.id, false).length} photos
                    </span>
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

          {/* Step 2 — photos */}
          <section>
            <StepHead index={2} title="Choose deck" hint={activeDeck.hint} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DECKS.map((item) => {
                const active = deck === item.id;
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
          </section>

          <div className="hairline" />

          {/* Step 3 — photos */}
          <section>
            <StepHead
              index={3}
              title="Drop your photos"
              hint={`${slots.length - missingPhotos.length}/${slots.length} added`}
            />
            <div className="mt-3">
              <Suspense fallback={<PanelSkeleton rows={3} />}>
                <UploadTray
                  shootType={shootType}
                  pushupBraOnly={pushupBraOnly}
                  images={images}
                  onChange={setImage}
                  needsBack={needsBack}
                />
              </Suspense>
            </div>
          </section>

          <div className="hairline" />

          {/* Step 4 — brand + look */}
          <section>
            <StepHead index={4} title="Brand & look" hint="Applied to every deck image" />
            <div className="mt-3 space-y-3">
              <Suspense fallback={<PanelSkeleton rows={1} />}>
                <BrandPicker value={brandId} onChange={setBrandId} disabled={locked} />
              </Suspense>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deck shots
                </p>
                <Suspense fallback={<span className="h-8 w-28 rounded-full bg-muted" />}>
                  <RefinePanel
                    aspect={aspect}
                    engine={engine}
                    note={note}
                    onAspect={setAspect}
                    onEngine={setEngine}
                    onNote={setNote}
                  />
                </Suspense>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeDeck.shots.map((shot) => (
                  <span
                    key={shot}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    {shot === "side1"
                      ? "Side 1"
                      : shot === "side2"
                        ? "Side 2"
                        : shot[0].toUpperCase() + shot.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Generate */}
          <Button
            variant="hero"
            size="xl"
            className="w-full rounded-2xl"
            disabled={!ready}
            onClick={generate}
          >
            {generating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Zap className="h-4 w-4" />}
            {generateLabel}
          </Button>
        </div>

        {/* Stage */}
        <div className="panel min-h-[520px] p-5">
          <Suspense fallback={<StageSkeleton />}>
            <Stage
              shots={shots}
              shootType={shootType}
              pushupBraOnly={pushupBraOnly}
              generating={generating}
              onRegenerate={regenerate}
              onDownloadAll={() => {
                const done = shots.filter((s) => s.status === "done");
                void import("@/components/studio/Stage").then(({ downloadShot }) => {
                  done.forEach((s, i) =>
                    timers.current.push(setTimeout(() => downloadShot(s), i * 250)),
                  );
                });
              }}
            />
          </Suspense>
        </div>
      </main>

      <footer className="mx-auto max-w-[1400px] px-5 pb-8 pt-2 text-center text-xs text-muted-foreground">
        Prototype preview — frames are stylized stand-ins for the Gemini composite. Ensure you hold
        rights to every uploaded photo.
      </footer>

      {authOpen ? (
        <Suspense fallback={null}>
          <AuthDialog
            open={authOpen}
            onOpenChange={setAuthOpen}
            onUnlock={(nextAuth) =>
              setAuth({
                ...nextAuth,
                used: loadStudioUsage(),
              })
            }
          />
        </Suspense>
      ) : null}
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

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-11 rounded-2xl bg-muted/70" />
      ))}
    </div>
  );
}

function StageSkeleton() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-paper/50 p-10 text-center">
      <div className="mb-4 h-14 w-14 rounded-2xl bg-primary/10" />
      <div className="h-7 w-48 rounded-full bg-muted" />
      <div className="mt-3 h-4 w-72 max-w-full rounded-full bg-muted/70" />
    </div>
  );
}
