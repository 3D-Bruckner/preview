import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientNameFor, personOf } from "next-app-kit/signin";
import { runtime } from "@/app/_lib/runtime";
import { SIGN_IN_PAGE } from "@/backend";
import { copyFor } from "@/components/copy";
import { ConsentForm } from "./ConsentForm";

// The consent page, copied from next-app-kit's examples/minimal (its README, "The consent page") in preview's words: Better Auth sends the
// signed-in person here during an MCP client's or a script's OAuth sign-in (openAuth's pages.consent), with the client and its scopes in
// a signed query; ConsentForm answers it, and the client gets its code.
export async function generateMetadata({ params }: PageProps<"/[lang]/consent">): Promise<Metadata> {
  return { title: copyFor((await params).lang).consent.title };
}

export default async function ConsentPage({ params, searchParams }: PageProps<"/[lang]/consent">) {
  // Headers first: reading them makes the page render per request, so `next build` never opens the app.
  const h = await headers();
  const t = copyFor((await params).lang).consent;
  const query = await searchParams;
  const rt = runtime();
  const auth = await rt.auth();
  // The kit's personOf without PREVIEW_DEV_USER, as the kit's example does: a consent is given by someone really signed in.
  const person = await personOf(h, auth);
  // Not signed in: to the sign-in page, carrying this page and its signed query as `?next=`, so the person comes back here.
  if (!person) {
    const back = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) back.append(k, one);
    redirect(`${SIGN_IN_PAGE}?${new URLSearchParams({ next: `/consent?${back}` })}`);
  }
  const clientId = typeof query.client_id === "string" ? query.client_id : "";
  const name = (clientId && (await clientNameFor(h, clientId, auth))) || t.unknownClient;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="mt-4">{t.asks(name, person.email)}</p>
      <p className="mt-2 text-neutral-600">{t.recorded}</p>
      <ConsentForm />
    </div>
  );
}
