import { describe, expect, it } from "vitest";
import { copyFor, languageOf, LOCALES, negotiate } from ".";
import { de } from "./de";
import { en } from "./en";

describe("negotiate", () => {
  it("takes the picked language first", () => {
    expect(negotiate("en", "de-DE,de;q=0.9")).toBe("en");
    expect(negotiate("de", "en")).toBe("de");
  });

  it("ignores a picked language the UI doesn't speak", () => {
    expect(negotiate("fr", "de")).toBe("de");
  });

  it("then the browser's Accept-Language by weight, a region matching its language", () => {
    expect(negotiate(undefined, "de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    expect(negotiate(undefined, "fr;q=1, en;q=0.5, de;q=0.7")).toBe("de");
    expect(negotiate(undefined, "de;q=0, en")).toBe("en");
  });

  it("else German", () => {
    expect(negotiate(undefined, null)).toBe("de");
    expect(negotiate(undefined, "fr, es")).toBe("de");
  });
});

describe("the copy modules", () => {
  it("speak English and German", () => {
    expect(LOCALES).toEqual(["en", "de"]);
    expect(copyFor("en")).toBe(en);
    expect(copyFor("xx")).toBe(de);
  });

  it("have the same keys in every language, down to the last string", () => {
    const keys = (o: object, at = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as object, `${at}${k}.`) : [`${at}${k}`]));
    for (const lang of LOCALES) expect(keys(copyFor(lang)).sort(), lang).toEqual(keys(en).sort());
  });
});

describe("languageOf", () => {
  it("is negotiate over a request's headers: the switch's cookie, then Accept-Language", () => {
    expect(languageOf(new Headers({ cookie: "a=b; preview_lang=en", "accept-language": "de" }))).toBe("en");
    expect(languageOf(new Headers({ cookie: "preview_lang=fr", "accept-language": "de-AT" }))).toBe("de");
    expect(languageOf(new Headers())).toBe("de");
  });

  it("each language has its sign-in mail, with the link only when there is one", () => {
    for (const lang of LOCALES) {
      const mail = copyFor(lang).mail;
      expect(mail.subject("123456")).toContain("123456");
      expect(mail.body("123456", "https://preview.example.com/l")).toContain("https://preview.example.com/l");
      expect(mail.body("123456", undefined)).not.toContain("http");
    }
  });
});
