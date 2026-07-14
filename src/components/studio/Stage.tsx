import { useMemo, useState } from "react";
import { Check, Clipboard, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BRANDS,
  DECK_SHOT_LABELS,
  REGENERATION_ISSUES,
  type AspectId,
  type GeneratedShot,
  type RegenerateIssue,
  type ShootType,
  buildRegenerationNote,
  shootTypeLabel,
} from "@/lib/studio";

function aspectRatio(id: AspectId): string {
  return ASPECTS.find((a) => a.id === id)?.ratio ?? "3 / 4";
}

function brandColors(brandId: string | null) {
  const brand = BRANDS.find((b) => b.id === brandId);
  return {
    bg: brand?.bg ?? "#f2e6da",
    fg: brand?.fg ?? "#8a6d5b",
    name: brand?.name ?? "Studio",
  };
}

/** A stylized studio frame standing in for the composited result. */
export function ShotFrame({
  shot,
  selected,
  onToggleSelected,
}: {
  shot: GeneratedShot;
  selected: boolean;
  onToggleSelected: () => void;
}) {
  const { bg, fg, name } = brandColors(shot.brandId);
  const poseLabel = DECK_SHOT_LABELS[shot.deckShot];

  return (
    <div
      data-shot={shot.id}
      className="relative w-full overflow-hidden rounded-2xl border border-border"
      style={{ aspectRatio: aspectRatio(shot.aspect) }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, ${bg} 0%, color-mix(in srgb, ${bg} 55%, #ffffff) 70%, #ffffff 100%)`,
        }}
      />
      {/* silhouette suggestion */}
      <div
        className="absolute bottom-0 left-1/2 h-[78%] w-[46%] -translate-x-1/2 rounded-t-[999px] opacity-25"
        style={{ background: `linear-gradient(180deg, ${fg}, transparent)` }}
      />
      <div
        className="absolute bottom-[14%] left-1/2 h-[26%] w-[30%] -translate-x-1/2 rounded-[40%] opacity-70"
        style={{ background: fg }}
      />
      {shot.status !== "done" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/55 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: fg }} />
          <span className="text-xs font-medium text-foreground/70">
            {shot.status === "rendering" ? "Rendering…" : "Queued"}
          </span>
        </div>
      )}
      {shot.status === "done" && (
        <button
          type="button"
          onClick={onToggleSelected}
          className={cn(
            "absolute right-2.5 top-2.5 z-10 inline-flex h-8 min-w-16 items-center justify-center gap-1 rounded-full border px-2 text-[0.68rem] font-semibold shadow-sm transition-colors",
            selected
              ? "border-success bg-success text-success-foreground"
              : "border-border bg-paper/90 text-foreground hover:border-primary",
          )}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : null}
          {selected ? "Picked" : "Select"}
        </button>
      )}
      <div className="absolute left-2.5 top-2.5 rounded-full bg-paper/85 px-2.5 py-1 text-[0.68rem] font-semibold text-foreground shadow-sm">
        {poseLabel}
      </div>
      <div
        className="absolute bottom-2.5 left-2.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold shadow-sm"
        style={{ background: fg, color: "#fff" }}
      >
        {name}
      </div>
      <div className="absolute bottom-2.5 right-2.5 rounded-full bg-paper/85 px-2 py-1 text-[0.62rem] font-medium text-muted-foreground">
        {shot.aspect}
      </div>
    </div>
  );
}

export function downloadShot(shot: GeneratedShot) {
  const { bg, fg, name } = brandColors(shot.brandId);
  const [w, h] = shot.aspect === "9:16" ? [720, 1280] : shot.aspect === "1:1" ? [1000, 1000] : [900, 1200];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const grad = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.72, w * 0.16, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.font = "600 40px Instrument Sans, sans-serif";
  ctx.fillText(name, 40, h - 48);
  const poseLabel = DECK_SHOT_LABELS[shot.deckShot];
  ctx.fillStyle = "#333";
  ctx.font = "500 30px Instrument Sans, sans-serif";
  ctx.fillText(poseLabel, 40, 60);
  const link = document.createElement("a");
  link.download = `studioflow-${name}-${shot.deckShot}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

interface StageProps {
  shots: GeneratedShot[];
  shootType: ShootType;
  pushupBraOnly: boolean;
  generating: boolean;
  onRegenerate: (id: string, note: string) => void;
  onDownloadAll: () => void;
}

export function Stage({
  shots,
  shootType,
  pushupBraOnly,
  generating,
  onRegenerate,
  onDownloadAll,
}: StageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issues, setIssues] = useState<Record<string, RegenerateIssue[]>>({});
  const doneCount = shots.filter((s) => s.status === "done").length;
  const selectedShots = useMemo(
    () => shots.filter((shot) => selectedIds.includes(shot.id)),
    [selectedIds, shots],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleIssue = (shotId: string, issue: RegenerateIssue) => {
    setIssues((prev) => {
      const current = prev[shotId] ?? [];
      const next = current.includes(issue)
        ? current.filter((item) => item !== issue)
        : [...current, issue];
      return { ...prev, [shotId]: next };
    });
  };

  const regenerateSelected = () => {
    selectedShots.forEach((shot) => {
      onRegenerate(shot.id, buildRegenerationNote(issues[shot.id] ?? []));
    });
    setDialogOpen(false);
    setSelectedIds([]);
    setIssues({});
  };

  if (shots.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-paper/50 p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl">Your shoot lands here</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Drop your photos, pick a brand, and one tap produces the whole pose set as a contact
          sheet with fixed Side 1, Side 2, Mood, Zoom, and Back deck shots.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Contact sheet</p>
          <h2 className="text-xl">
            {shootTypeLabel(shootType, pushupBraOnly)} · {doneCount}/{shots.length} deck images
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={onDownloadAll}
            disabled={doneCount === 0}
            className="rounded-full"
          >
            <Download className="h-3.5 w-3.5" />
            Download all
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={selectedIds.length === 0 || generating}
            className="rounded-full"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-generate selected
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid flex-1 content-start gap-4 overflow-y-auto pr-1",
          "grid-cols-2 xl:grid-cols-3",
        )}
      >
        {shots.map((shot) => (
          <div key={shot.id} className="group space-y-2">
            <ShotFrame
              shot={shot}
              selected={selectedIds.includes(shot.id)}
              onToggleSelected={() => toggleSelected(shot.id)}
            />
            <div className="flex items-center justify-between gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 justify-center rounded-full text-xs"
                disabled={shot.status !== "done"}
                onClick={() => downloadShot(shot)}
              >
                <Download className="h-3 w-3" />
                Save
              </Button>
              <RedoButton disabled={shot.status !== "done" || generating} onRedo={(n) => onRegenerate(shot.id, n)} />
              <PromptButton disabled={shot.status !== "done"} shot={shot} />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>What is wrong in the selected images?</DialogTitle>
          </DialogHeader>
          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {selectedShots.map((shot, index) => (
              <div key={shot.id} className="rounded-2xl border border-border bg-paper p-4">
                <h3 className="text-sm font-semibold">
                  Image {index + 1} - {DECK_SHOT_LABELS[shot.deckShot]}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REGENERATION_ISSUES.map((issue) => {
                    const active = (issues[shot.id] ?? []).includes(issue.id);
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        onClick={() => toggleIssue(shot.id, issue.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        {issue.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="soft" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={regenerateSelected}>
              Submit and regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromptButton({ disabled, shot }: { disabled: boolean; shot: GeneratedShot }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 flex-1 justify-center rounded-full text-xs"
          disabled={disabled}
        >
          <Clipboard className="h-3 w-3" />
          Prompt
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,90vw)] space-y-2" align="end">
        <div>
          <p className="text-xs font-semibold text-foreground">
            {shot.promptSource} · {shot.promptSection}
          </p>
          <p className="text-[0.68rem] text-muted-foreground">
            {DECK_SHOT_LABELS[shot.deckShot]} · brand spec applied
          </p>
        </div>
        <Textarea
          readOnly
          value={shot.prompt}
          className="max-h-72 min-h-52 resize-none font-mono text-[0.68rem]"
        />
        <Button
          size="sm"
          variant="hero"
          className="w-full rounded-full"
          onClick={() => void navigator.clipboard?.writeText(shot.prompt)}
        >
          Copy prompt
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function RedoButton({
  disabled,
  onRedo,
}: {
  disabled: boolean;
  onRedo: (note: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 flex-1 justify-center rounded-full text-xs"
          disabled={disabled}
        >
          <RefreshCw className="h-3 w-3" />
          Redo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <p className="text-xs font-medium text-foreground">What should change?</p>
        <Textarea
          id="redo-note"
          placeholder="e.g. brighter lighting, tighter crop…"
          className="min-h-16 resize-none text-sm"
        />
        <Button
          size="sm"
          variant="hero"
          className="w-full rounded-full"
          onClick={(e) => {
            const wrap = (e.currentTarget.closest("[data-radix-popper-content-wrapper]") ??
              e.currentTarget.parentElement) as HTMLElement | null;
            const ta = wrap?.querySelector("#redo-note") as HTMLTextAreaElement | null;
            onRedo(ta?.value ?? "");
          }}
        >
          Regenerate this shot
        </Button>
      </PopoverContent>
    </Popover>
  );
}
