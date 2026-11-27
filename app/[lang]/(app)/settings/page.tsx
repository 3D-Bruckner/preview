import type { Metadata } from "next";
import { listApiTokens } from "next-app-kit/tokens";
import { requirePerson } from "@/app/_lib/signin";
import { runtime } from "@/app/_lib/runtime";
import { copyFor } from "@/components/copy";
import { formatDay, formatWhen } from "@/components/format";
import { ui } from "@/components/ui";
import { SignOut } from "./SignOut";
import { Tokens } from "./Tokens";

export async function generateMetadata({ params }: PageProps<"/[lang]/settings">): Promise<Metadata> {
  return { title: copyFor((await params).lang).settings.title };
}

// API tokens (made, listed with their last use, revoked; a new one shown once), the kit's.
export default async function SettingsPage({ params }: PageProps<"/[lang]/settings">) {
  const person = await requirePerson("/settings");
  const lang = (await params).lang;
  const t = copyFor(lang).settings;
  // The dev user is no Better Auth user and has no tokens.
  const tokens = person.id.startsWith("dev:") ? [] : await listApiTokens(await runtime().auth(), person.id);
  return (
    <>
      <h1 className={ui.h1}>{t.title}</h1>
      <Tokens
        tokens={tokens.map((k) => ({
          id: k.id,
          name: k.name,
          scope: k.scope,
          lastUsed: k.last_used_at ? formatWhen(lang, k.last_used_at) : null,
          expires: k.expires_at ? formatDay(lang, k.expires_at) : null,
        }))}
      />
      {/* The dev user has no session to end. */}
      {!person.id.startsWith("dev:") && <SignOut />}
    </>
  );
}
