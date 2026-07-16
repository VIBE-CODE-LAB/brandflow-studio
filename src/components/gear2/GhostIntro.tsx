import { useEffect, useState } from "react";

const GHOST_INTRO_SRC = `${import.meta.env.BASE_URL}gear2/ghost-intro.mp4`;

interface GhostIntroProps {
  onDone: () => void;
}

/** Full-screen video cinematic that opens Gear 2 — plays once, skippable. */
export function GhostIntro({ onDone }: GhostIntroProps) {
  const [showSkipHint, setShowSkipHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSkipHint(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const skip = () => onDone();
    window.addEventListener("keydown", skip, { once: true });
    return () => window.removeEventListener("keydown", skip);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={onDone}>
      <video
        className="h-full w-full object-cover"
        src={GHOST_INTRO_SRC}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
      />
      <p
        className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium tracking-wide text-white/60 transition-opacity duration-500 ${
          showSkipHint ? "opacity-100" : "opacity-0"
        }`}
      >
        Press any key or click to skip
      </p>
    </div>
  );
}
