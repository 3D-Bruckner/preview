import type { Metadata } from "next";
import { headers } from "next/headers";
import { MAIL_NOT_SENT, refusedSignIn, safeNext, signInMethods, type RefusedSignIn } from "next-app-kit/signin";
import { runtime } from "@/app/_lib/runtime";
import { SIGN_IN_PAGE } from "@/backend";
import { copyFor, type Copy } from "@/components/copy";
import { SignInForm } from "./SignInForm";

// The sign-in page, at /signin (openAuth's pages.signIn), keeping next-app-kit's contract (its README, "The sign-in page"): it carries
// `?next=` as each method's callbackURL, offers what signInMethods says (a code by mail, which also brings a link; a button
// per provider) and shows a refused sign-in's `?error=` in the page's words, never the provider's free text. A code the mail server would
// not take is said as such (the kit answers MAIL_NOT_SENT), not asked for.
export async function generateMetadata({ params }: PageProps<"/[lang]/signin">): Promise<Metadata> {
  return { title: copyFor((await params).lang).signIn.title };
}

function refusal(r: RefusedSignIn, t: Copy["signIn"]["refused"]): string {
  if (r.code === "email_not_allowed" || r.code === "email_not_verified") return t[r.code];
  if (r.code === "INVALID_TOKEN") return t.link;
  return r.provider ? t.byProvider(r.provider) : t.other;
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[lang]/signin">) {
  // Headers first: reading them makes the page render per request, so `next build` never opens the app.
  await headers();
  const t = copyFor((await params).lang).signIn;
  const query = await searchParams;
  const { signIn } = runtime();
  const refused = refusedSignIn(query, signIn);
  // Only what this app offers goes to the browser; the kit also reports passkeys, which it doesn't (ADR 0004).
  const { email, providers } = signInMethods(signIn);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="mt-2 text-neutral-600">{t.intro}</p>
      {refused && (
        <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-900">
          {refusal(refused, t.refused)}
        </p>
      )}
      <SignInForm next={safeNext(query.next)} methods={{ email, providers }} signInPage={SIGN_IN_PAGE} mailNotSent={MAIL_NOT_SENT.code} />
    </div>
  );
}
