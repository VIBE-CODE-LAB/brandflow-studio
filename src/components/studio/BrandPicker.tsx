import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BRANDS, type Brand } from "@/lib/studio";

interface BrandPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function Swatch({ brand, size = 20 }: { brand: Brand; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-border/60"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${brand.bg} 0 50%, ${brand.fg} 50% 100%)`,
      }}
    />
  );
}

export function BrandPicker({ value, onChange, disabled }: BrandPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = BRANDS.find((b) => b.id === value) ?? null;

  if (disabled) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Brand styling isn&apos;t used for Panty-only shoots
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="soft"
          className="h-11 w-full justify-between rounded-xl px-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2.5">
            {selected ? <Swatch brand={selected} /> : null}
            {selected ? selected.name : "Choose a brand"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search 11 brands…" />
          <CommandList>
            <CommandEmpty>No brand found.</CommandEmpty>
            <CommandGroup>
              {BRANDS.map((brand) => (
                <CommandItem
                  key={brand.id}
                  value={brand.name}
                  onSelect={() => {
                    onChange(brand.id);
                    setOpen(false);
                  }}
                  className="gap-2.5"
                >
                  <Swatch brand={brand} size={18} />
                  <span className="flex-1">{brand.name}</span>
                  <Check
                    className={cn(
                      "h-4 w-4 text-primary",
                      value === brand.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
