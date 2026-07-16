import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShotFrame } from "@/components/studio/Stage";
import type { BraDeck } from "@/lib/gear2";

interface BraDeckDetailViewProps {
  deck: BraDeck;
  index: number;
  selectedForRegen: string[];
  onToggleSelect: (shotId: string) => void;
  onBack: () => void;
}

/** One open bra deck's shots — selections here write into the shared cross-deck regen tray. */
export function BraDeckDetailView({ deck, index, selectedForRegen, onToggleSelect, onBack }: BraDeckDetailViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">Bra deck</p>
          <h2 className="text-xl text-white">Bra {index + 1}</h2>
        </div>
        <Button variant="ghost" size="sm" className="h-8 rounded-full text-white/70 hover:text-white" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to decks (-)
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {deck.shots.map((shot) => (
          <ShotFrame
            key={shot.id}
            shot={shot}
            selected={selectedForRegen.includes(shot.id)}
            onToggleSelected={() => onToggleSelect(shot.id)}
          />
        ))}
      </div>
    </div>
  );
}
