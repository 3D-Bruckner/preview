import type { MetadataRoute } from "next";
import { runtime } from "@/app/_lib/runtime";

// What the Home Screen needs to run the app full-screen (Safari → Share → Add to Home Screen). No service worker: an upload needs the
// server anyway. The manifest can't follow the system's dark mode, so its colours are the light ones; the page's own theme-color
// (app/[lang]/layout.tsx) follows it. The icons are made by scripts/generate-icons.mjs from app/icon.svg; the name is the
// instance's brand (PREVIEW_BRAND_NAME), so the manifest is made per request.
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  const name = runtime().config.brand.name;
  return {
    name,
    short_name: name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
