import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Makes MessFit installable as a PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MessFit",
    short_name: "MessFit",
    description:
      "Eat right from what your mess actually serves — plate optimizer + fitness coach for Indian hostel students.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    orientation: "portrait",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
