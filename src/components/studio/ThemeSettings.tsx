import { Monitor, Moon, Plus, Settings, Sun, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ThemeMode = "system" | "light" | "dark";

export function ThemeSettings({
  mode,
  onChange,
  onAddBrand,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  onAddBrand: () => void;
}) {
  const options: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Theme settings">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 space-y-1 p-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{option.label}</span>
            </button>
          );
        })}
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={onAddBrand}
          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">Add Brands</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
