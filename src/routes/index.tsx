import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UploadTray, type ImageMap } from "@/components/studio/UploadTray";
import { BrandPicker } from "@/components/studio/BrandPicker";
import { RefinePanel } from "@/components/studio/RefinePanel";
import { Stage, downloadShot } from "@/components/studio/Stage";
import {
  SHOOT_TYPES,
  POSES,
  type AspectId,
  type EngineId,
  type GeneratedShot,
  type Pose,
  type ShootType,
  allowedPoses,
  brandLocked,
  defaultPoses,
  requiredSlots,
} from "@/lib/studio";

export const Route = createFileRoute("/")({
  component: StudioFlow,
});

let shotCounter = 0;
const nextId = () => `shot-${Date.now()}-${shotCounter++}`;

function StudioFlow() {
  const [shootType, setShootType] = useState<ShootType>("bra_panty");
  const [pushupBraOnly, setPushupBraOnly] = useState(false);
  const [images, setImages] = useState<ImageMap>({});
  const [brandId, setBrandId] = useState<string | null>("tweens");
  const [poses, setPoses] = useState<Pose[]>(defaultPoses("bra_panty"));
  const [aspect, setAspect] = useState<AspectId>("3:4");
  const [engine, setEngine] = useState<EngineId>("fast");
  const [note, setNote] = useState("");
  const [shots, setShots] = useState<GeneratedShot[]>([]);
  const [generating, setGenerating] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const slots = requiredSlots(shootType, pushupBraOnly);
  const allowed = allowedPoses(shootType);
  const needsBack = poses.includes("back");
  const locked = brandLocked(shootType);

  const missingPhotos = slots.filter((s) => !images[s]);
  const ready =
    missingPhotos.length === 0 && poses.length > 0 && (locked || Boolean(brandId)) && !generating;

  const changeShootType = useCallback((next: ShootType) => {
    setShootType(next);
    setPushupBraOnly(false);
    setPoses(defaultPoses(next));
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

  const togglePose = useCallback(
    (p: Pose) => {
      setPoses((prev) =>
        prev.includes(p) ? prev.filter((x) => x !== p) : [...allowed.filter((a) => prev.includes(a) || a === p)],
      );
    },
    [allowed],
  );

  const orderedPoses = useMemo(() => allowed.filter((p) => poses.includes(p)), [allowed, poses]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const generate = useCallback(() => {
    if (!ready) return;
    clearTimers();
    const queued: GeneratedShot[] = orderedPoses.map((pose) => ({
      id: nextId(),
      pose,
      aspect,
      brandId: locked ? null : brandId,
      shootType,
      status: "queued",
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
  }, [ready, orderedPoses, aspect, brandId, locked, shootType]);

  const regenerate = useCallback((id: string, redoNote: string) => {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, status: "rendering", note: redoNote } : s)));
    timers.current.push(
      setTimeout(() => {
        setShots((prev) => prev.map((s) => (s.id === id ? { ...s, status: "done" } : s)));
      }, 900),
    );
  }, []);

  const generateLabel = generating
    ? "Rendering your shoot…"
    : missingPhotos.length > 0
      ? `Add ${missingPhotos.join(" + ")} to start`
      : poses.length === 0
        ? "Pick at least one pose"
        : !locked && !brandId
          ? "Choose a brand"
          : `Generate ${poses.length}-shot set`;

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Pro active
          </span>
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
            <StepHead
              index={2}
              title="Drop your photos"
              hint={`${slots.length - missingPhotos.length}/${slots.length} added`}
            />
            <div className="mt-3">
              <UploadTray
                shootType={shootType}
                pushupBraOnly={pushupBraOnly}
                images={images}
                onChange={setImage}
                needsBack={needsBack}
              />
            </div>
          </section>

          <div className="hairline" />

          {/* Step 3 — brand + look */}
          <section>
            <StepHead index={3} title="Brand & look" hint="Smart defaults set" />
            <div className="mt-3 space-y-3">
              <BrandPicker value={brandId} onChange={setBrandId} disabled={locked} />

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Poses in this set
                </p>
                <RefinePanel
                  aspect={aspect}
                  engine={engine}
                  note={note}
                  onAspect={setAspect}
                  onEngine={setEngine}
                  onNote={setNote}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POSES.map((p) => {
                  const isAllowed = allowed.includes(p.id);
                  const active = poses.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => togglePose(p.id)}
                      title={p.hint}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        !isAllowed && "cursor-not-allowed opacity-30",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-accent",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
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
          <Stage
            shots={shots}
            shootType={shootType}
            pushupBraOnly={pushupBraOnly}
            generating={generating}
            onRegenerate={regenerate}
            onDownloadAll={() => {
              const done = shots.filter((s) => s.status === "done");
              done.forEach((s, i) => timers.current.push(setTimeout(() => downloadShot(s), i * 250)));
            }}
          />
        </div>
      </main>

      <footer className="mx-auto max-w-[1400px] px-5 pb-8 pt-2 text-center text-xs text-muted-foreground">
        Prototype preview — frames are stylized stand-ins for the Gemini composite. Ensure you hold
        rights to every uploaded photo.
      </footer>
    </div>
  );
}


function downloadOne(shot: GeneratedShot) {
  const evt = new CustomEvent("studioflow-download", { detail: shot });
  window.dispatchEvent(evt);
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
