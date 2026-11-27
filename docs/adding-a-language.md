# Adding a language

The pages speak German and English, German by default. A language is two things: the words of the interface, and whether a customer's page can be set to open in it. The first alone already makes the language available to the language switch and to browsers that ask for it.

## The words

1. Copy `components/copy/en.ts` (the reference) to `components/copy/<code>.ts`, for example `fr.ts`, and export it typed as `Copy` (`export const fr: Copy = { … }`, as `de.ts` does). Translate every value; TypeScript refuses a missing key.
2. Add it to `COPIES` in `components/copy/index.ts` (`{ en, de, fr }`). `LOCALES`, the language switch, `proxy.ts`'s pick from `Accept-Language` and the `app/[lang]/` routes follow from that list.
3. `npm test`: `copy.test.ts` checks that every module has the same keys as the reference.

The language of a request is the switch's cookie, then `Accept-Language`, then German. A customer's page opens in the language the operator set for that customer unless the visitor picked another.

## A language for a customer

The customer's language is a separate, narrower list (`de` and `en`), kept in a database column. To offer the new language there too:

- `backend/customers.ts`: the `Language` type and `LANGUAGES`.
- `backend/shapes.ts`: the two `z.enum(["de", "en"])`, which are also what REST and MCP accept.
- `backend/db/schema.ts` and a new migration in `backend/db/migrations.ts` that widens the column's `check (language in …)` (SQLite needs the table rebuilt for that; never edit an existing migration).
- `app/[lang]/(app)/NewCustomer.tsx` (an `<option>`), `app/[lang]/(app)/actions.ts` (`languageField`) and `language.names` in every copy module.
- Regenerate the API description: `npm run generate`, which rewrites `openapi.json`.

Then run the whole chain from the README. A pull request that adds a language is welcome ([`CONTRIBUTING.md`](../CONTRIBUTING.md)).
