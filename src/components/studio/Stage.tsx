import { Download, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BRANDS,
  POSES,
  type AspectId,
  type GeneratedShot,
  type ShootType,
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
export function ShotFrame({ shot }: { shot: GeneratedShot }) {
  const { bg, fg, name } = brandColors(shot.brandId);
  const poseLabel = POSES.find((p) => p.id === shot.pose)?.label ?? shot.pose;

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
  const poseLabel = POSES.find((p) => p.id === shot.pose)?.label ?? shot.pose;
  ctx.fillStyle = "#333";
  ctx.font = "500 30px Instrument Sans, sans-serif";
  ctx.fillText(poseLabel, 40, 60);
  const link = document.createElement("a");
  link.download = `studioflow-${name}-${shot.pose}.png`;
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
  const doneCount = shots.filter((s) => s.status === "done").length;

  if (shots.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-paper/50 p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl">Your shoot lands here</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Drop your photos, pick a brand, and one tap produces the whole pose set as a contact
          sheet — no pose-by-pose pop-ups.
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
            {shootTypeLabel(shootType, pushupBraOnly)} · {doneCount}/{shots.length} shots
          </h2>
        </div>
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
      </div>

      <div
        className={cn(
          "grid flex-1 content-start gap-4 overflow-y-auto pr-1",
          "grid-cols-2 xl:grid-cols-3",
        )}
      >
        {shots.map((shot) => (
          <div key={shot.id} className="group space-y-2">
            <ShotFrame shot={shot} />
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
            </div>
          </div>
        ))}
      </div>
    </div>
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
