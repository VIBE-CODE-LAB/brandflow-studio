import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sliders } from "lucide-react";

import { cn } from "@/lib/utils";
import { ASPECTS, ENGINES, type AspectId, type EngineId } from "@/lib/studio";

interface RefinePanelProps {
  aspect: AspectId;
  engine: EngineId;
  note: string;
  onAspect: (a: AspectId) => void;
  onEngine: (e: EngineId) => void;
  onNote: (n: string) => void;
}

export function RefinePanel({
  aspect,
  engine,
  note,
  onAspect,
  onEngine,
  onNote,
}: RefinePanelProps) {
  const aspectLabel = ASPECTS.find((a) => a.id === aspect)?.label ?? aspect;
  const engineLabel = ENGINES.find((e) => e.id === engine)?.label ?? engine;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full text-xs">
          <Sliders className="h-3.5 w-3.5" />
          {aspectLabel} · {engineLabel}
          {note ? " · note" : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="end">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aspect
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAspect(a.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  aspect === a.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Engine
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ENGINES.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onEngine(e.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition-colors",
                  engine === e.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="block text-sm font-medium text-foreground">{e.label}</span>
                <span className="block text-[0.68rem] text-muted-foreground">{e.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Creative note <span className="normal-case text-muted-foreground/70">(optional)</span>
          </p>
          <Textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="Mood, lighting, styling direction…"
            className="min-h-20 resize-none text-sm"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
