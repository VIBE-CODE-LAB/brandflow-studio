import { forwardRef, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

interface GhostLoaderProps {
  size?: "sm" | "lg";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

/** The animated ghost-eye 3D loader — click to open Gear 2. */
export const GhostLoader = forwardRef<HTMLButtonElement, GhostLoaderProps>(function GhostLoader(
  { size = "sm", onClick, className },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="Open Gear 2"
      className={cn(
        "ghost-loader inline-flex items-center justify-center rounded-full",
        size === "lg" && "ghost-loader--lg",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className="ghost-head" />
      <div className="ghost-flames">
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
        <div className="ghost-particle" />
      </div>
      <div className="ghost-eye" />
    </button>
  );
});
