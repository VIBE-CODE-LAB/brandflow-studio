import { useEffect } from "react";

import { isTypingTarget } from "@/lib/gear2Shortcuts";

/** Global Ctrl+Alt+F12 to open the Book View — active only while it's closed. */
export function useBookOpenShortcut(onOpen: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey && event.altKey && event.key === "F12") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen, enabled]);
}

interface BookInAppShortcutsOptions {
  onEnter: () => void;
  onClose: () => void;
  enabled: boolean;
}

/** Enter to advance the current page, Escape to close the Book View. */
export function useBookInAppShortcuts({ onEnter, onClose, enabled }: BookInAppShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        onEnter();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEnter, onClose, enabled]);
}
