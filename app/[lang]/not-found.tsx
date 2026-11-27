import { headers } from "next/headers";
import { LANG_HEADER } from "@/components/copy";
import { NotFound } from "@/components/NotFound";

// A page that answered notFound() (an unknown customer link, another customer's model): in the root layout, the same words as an address
// no route matches (app/global-not-found.tsx renders the same document). Its language is the page's, from proxy.ts's header.
export default async function LangNotFound() {
  return <NotFound lang={(await headers()).get(LANG_HEADER) ?? ""} />;
}
