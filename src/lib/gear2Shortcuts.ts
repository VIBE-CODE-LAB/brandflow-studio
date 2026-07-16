import { useEffect } from "react";

/** True while focus is in a field where plain keystrokes must type normally, not trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Global Ctrl+Shift+V to open Gear 2 — active only while it's closed. */
export function useGear2OpenShortcut(onOpen: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen, enabled]);
}

interface Gear2InAppShortcutsOptions {
  onClose: () => void;
  onGenerate: () => void;
  canGenerate: boolean;
  isControlsPhase: boolean;
  isEngineGrid: boolean;
  isEngineDeck: boolean;
  onOpenDeckByNumber: (index: number) => void;
  onCloseDeck: () => void;
  anyDialogOpen: boolean;
}

/** Backspace/+ to exit, Ctrl+Enter to generate, 1-9/0 to open a deck, - to close a deck. */
export function useGear2InAppShortcuts({
  onClose,
  onGenerate,
  canGenerate,
  isControlsPhase,
  isEngineGrid,
  isEngineDeck,
  onOpenDeckByNumber,
  onCloseDeck,
  anyDialogOpen,
}: Gear2InAppShortcutsOptions) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (!event.ctrlKey && !event.metaKey && (event.key === "Backspace" || event.key === "+" || event.key === "=")) {
        if (anyDialogOpen) return;
        event.preventDefault();
        onClose();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (isControlsPhase && canGenerate) {
          event.preventDefault();
          onGenerate();
        }
        return;
      }

      if (anyDialogOpen) return;

      if (isEngineGrid && /^[0-9]$/.test(event.key)) {
        event.preventDefault();
        const index = event.key === "0" ? 9 : Number(event.key) - 1;
        onOpenDeckByNumber(index);
        return;
      }

      if (isEngineDeck && event.key === "-") {
        event.preventDefault();
        onCloseDeck();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onClose,
    onGenerate,
    canGenerate,
    isControlsPhase,
    isEngineGrid,
    isEngineDeck,
    onOpenDeckByNumber,
    onCloseDeck,
    anyDialogOpen,
  ]);
}
