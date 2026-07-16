import { useCallback, useState, type CSSProperties, type MouseEvent } from "react";

interface TiltOptions {
  /** Max rotation in degrees at the edge of the element. */
  max?: number;
  /** Scale applied while hovering. */
  scale?: number;
}

const RESTING: CSSProperties = {
  transform: "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)",
  transition: "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)",
};

/** Magnetic 3D tilt-on-hover — follows the cursor, springs back on leave. */
export function useTilt({ max = 10, scale = 1.05 }: TiltOptions = {}) {
  const [style, setStyle] = useState<CSSProperties>(RESTING);

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * max * 2;
      const rotateX = (0.5 - py) * max * 2;
      setStyle({
        transform: `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        transition: "transform 70ms linear",
      });
    },
    [max, scale],
  );

  const onMouseLeave = useCallback(() => setStyle(RESTING), []);

  return { style, onMouseMove, onMouseLeave };
}
