import type { Metadata } from "next";
import { requirePerson } from "@/app/_lib/signin";
import { copyFor } from "@/components/copy";
import { ui } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  return { title: copyFor((await params).lang).home.title };
}

// The start page for whoever runs the instance: the customers. A placeholder until the customers exist (the admin pages replace it).
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  await requirePerson("/");
  const t = copyFor((await params).lang).home;
  return (
    <>
      <h1 className={ui.h1}>{t.title}</h1>
      <p className="mt-4 text-muted">{t.empty}</p>
    </>
  );
}
