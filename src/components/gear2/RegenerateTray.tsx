import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DECK_SHOT_LABELS,
  REGENERATION_ISSUES,
  buildRegenerationNote,
  type GeneratedShot,
  type RegenerateIssue,
} from "@/lib/studio";

interface RegenerateTrayProps {
  shots: GeneratedShot[];
  onRemove: (shotId: string) => void;
  onRegenerate: (braId: string, shotId: string, note: string) => void;
  onClear: () => void;
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
}

/** Persistent bottom tray of images marked wrong across any number of decks. */
export function RegenerateTray({ shots, onRemove, onRegenerate, onClear, dialogOpen, onDialogOpenChange }: RegenerateTrayProps) {
  const [issues, setIssues] = useState<Record<string, RegenerateIssue[]>>({});

  if (shots.length === 0) return null;

  const toggleIssue = (shotId: string, issue: RegenerateIssue) => {
    setIssues((prev) => {
      const current = prev[shotId] ?? [];
      const next = current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue];
      return { ...prev, [shotId]: next };
    });
  };

  const submit = () => {
    for (const shot of shots) {
      if (!shot.braId) continue;
      onRegenerate(shot.braId, shot.id, buildRegenerationNote(issues[shot.id] ?? []));
    }
    onDialogOpenChange(false);
    setIssues({});
    onClear();
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 overflow-x-auto">
            {shots.map((shot) => (
              <div key={shot.id} className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/20">
                {shot.imageUrl ? (
                  <img src={shot.imageUrl} alt={DECK_SHOT_LABELS[shot.deckShot]} className="h-full w-full object-cover" />
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemove(shot.id)}
                  aria-label="Remove from selection"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="hero" size="sm" className="shrink-0 rounded-full" onClick={() => onDialogOpenChange(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate {shots.length}
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>What is wrong in the selected images?</DialogTitle>
          </DialogHeader>
          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {shots.map((shot, index) => (
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
            <Button variant="soft" onClick={() => onDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={submit}>
              Submit and regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
