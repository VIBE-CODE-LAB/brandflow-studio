import { Lock } from "lucide-react";
import { BRANDS, type Brand } from "@/lib/studio";

interface BrandPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  brands?: Brand[];
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

export function BrandPicker({ value, onChange, disabled, brands = BRANDS }: BrandPickerProps) {
  const selected = brands.find((b) => b.id === value) ?? null;

  if (disabled) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Brand styling isn&apos;t used for Panty-only shoots
      </div>
    );
  }

  return (
    <label className="relative flex h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-paper px-3 text-sm font-medium">
      {selected ? <Swatch brand={selected} /> : null}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="brand-picker-select h-full min-w-0 flex-1 appearance-none bg-transparent pr-8 text-foreground outline-none"
        aria-label="Choose a brand"
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id} className="bg-popover text-popover-foreground">
            {brand.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">Select</span>
    </label>
  );
}
