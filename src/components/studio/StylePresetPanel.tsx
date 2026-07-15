import { useMemo, useState } from "react";
import { Check, Link2, Loader2, RefreshCw, Unlink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DeckShotKey } from "@/lib/studio";
import { PRESET_POSE_LABELS, findPreset, isPresetPose, searchStylesByNumber, type StylePreset } from "@/lib/stylePresets";

interface StylePresetPanelProps {
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  onSync: () => void;
  onDisconnect: () => void;
  syncing: boolean;
  syncMessage: string | null;
  syncError: string | null;
  presets: StylePreset[];
  selectedStyleName: string | null;
  onSelectStyle: (styleName: string | null) => void;
  activeDeckShots: DeckShotKey[];
}

export function StylePresetPanel({
  sheetUrl,
  onSheetUrlChange,
  onSync,
  onDisconnect,
  syncing,
  syncMessage,
  syncError,
  presets,
  selectedStyleName,
  onSelectStyle,
  activeDeckShots,
}: StylePresetPanelProps) {
  const [search, setSearch] = useState("");

  const posesInDeck = useMemo(() => activeDeckShots.filter(isPresetPose), [activeDeckShots]);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    return searchStylesByNumber(presets, search.trim());
  }, [presets, search]);

  const coverageFor = (styleName: string) =>
    posesInDeck.filter((pose) => findPreset(presets, styleName, pose)).length;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style preset</p>
        {presets.length > 0 ? (
          <span className="text-[0.68rem] text-muted-foreground">{presets.length} rows synced</span>
        ) : null}
      </div>

      <div className="flex gap-1.5">
        <Input
          value={sheetUrl}
          onChange={(e) => onSheetUrlChange(e.target.value)}
          placeholder="Google Sheet URL"
          className="h-9 flex-1 rounded-full text-xs"
        />
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="h-9 shrink-0 rounded-full"
          disabled={!sheetUrl.trim() || syncing}
          onClick={onSync}
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sync
        </Button>
        {sheetUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 rounded-full"
            onClick={onDisconnect}
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {syncMessage ? (
        <p className="flex items-center gap-1.5 text-[0.68rem] text-success">
          <Check className="h-3 w-3 shrink-0" />
          {syncMessage}
        </p>
      ) : null}
      {syncError ? <p className="text-[0.68rem] text-destructive">{syncError}</p> : null}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Search style № (e.g. 68)"
            inputMode="numeric"
            className="h-9 flex-1 rounded-full text-xs"
            disabled={presets.length === 0}
          />
        </div>

        {selectedStyleName ? (
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
            <span className="text-xs font-semibold text-primary">{selectedStyleName}</span>
            <button
              type="button"
              onClick={() => onSelectStyle(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {search.trim() && matches.length === 0 ? (
          <p className="text-[0.68rem] text-muted-foreground">No styles found for "{search}".</p>
        ) : null}

        {matches.length > 0 ? (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-1">
            {matches.map((styleName) => {
              const covered = coverageFor(styleName);
              const active = styleName === selectedStyleName;
              return (
                <button
                  key={styleName}
                  type="button"
                  onClick={() => {
                    onSelectStyle(styleName);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="font-medium">{styleName}</span>
                  <span className={cn("text-[0.62rem]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {covered}/{posesInDeck.length} poses
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!search.trim() && !selectedStyleName ? (
          <p className="text-[0.68rem] text-muted-foreground">
            {presets.length === 0
              ? "Sync a Google Sheet, then search a style number to apply its heading/callouts to the whole deck."
              : `Type a style number to filter — poses covered: ${posesInDeck.map((p) => PRESET_POSE_LABELS[p]).join(", ")}.`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
