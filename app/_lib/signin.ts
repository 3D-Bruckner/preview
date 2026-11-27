import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Person } from "next-app-kit/signin";
import { SIGN_IN_PAGE } from "@/backend";
import { runtime } from "./runtime";

/**
 * The signed-in person of a page's request, or a redirect to the sign-in page with `path` (the page's own path and query, as the browser
 * sees it: no language in it) as `?next=`, so the person comes back here once signed in.
 */
export async function requirePerson(path: string): Promise<Person> {
  const person = await runtime().person(await headers());
  if (!person) redirect(`${SIGN_IN_PAGE}?${new URLSearchParams({ next: path })}`);
  return person;
}

/** The signed-in person of a server action's request, or null: every action checks it itself (an action is reachable by a plain POST). */
export async function actionPerson(): Promise<Person | null> {
  return runtime().person(await headers());
}
