import type { Metadata, Viewport } from "next";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";

// What every document's head says, the root layout's (app/[lang]/layout.tsx) and the one of an address no route matches
// (app/global-not-found.tsx), so a 404 looks the same whichever way it came. The brand's name is the instance's own (backend/config.ts).
export function documentMetadata(lang: string): Metadata {
  const name = runtime().config.brand.name;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: copyFor(lang).app.description,
    robots: { index: false, follow: false },
    // Added to the Home Screen it runs full-screen (the manifest says so too). Next writes mobile-web-app-capable for `capable`; older iOS
    // reads only the apple- name, so that one is added by hand.
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

// viewport-fit=cover lets the page reach under the notch and the home indicator; globals.css keeps the content out of them.
export const VIEWPORT: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};
