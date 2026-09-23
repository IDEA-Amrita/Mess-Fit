"use client";

import { useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Card with a soft accent glow that follows the cursor (the "spotlight" effect
 * used by Linear/Vercel-style bento grids).
 *
 * The pointer position is written to CSS variables on the element rather than
 * React state, so tracking the mouse causes zero re-renders. On touch devices
 * there's no hover, so the glow simply never appears.
 */
export function SpotlightCard({ className, children, onPointerMove, ...rest }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
          el.style.setProperty("--my", `${e.clientY - rect.top}px`);
        }
        onPointerMove?.(e);
      }}
      className={cn("spotlight-card group/spot relative overflow-hidden", className)}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), rgba(204,255,0,0.10), transparent 60%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
