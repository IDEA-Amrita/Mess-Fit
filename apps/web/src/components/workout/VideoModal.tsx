"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Lazy demo-video overlay. The iframe is only mounted while the modal is open
 * (the parent conditionally renders this component on "Watch demo"), so no
 * YouTube network requests fire until the user explicitly asks for the video.
 * Uses the privacy-enhanced youtube-nocookie host.
 */
export function VideoModal({
  videoId,
  title,
  onClose,
}: {
  videoId: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
      role="dialog"
      aria-label={`${title} demo video`}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
            {title}
          </p>
          <button onClick={onClose} aria-label="Close" style={{ color: "#888" }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={`${title} demonstration`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
