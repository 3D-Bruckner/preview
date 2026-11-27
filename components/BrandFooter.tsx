import type { Brand } from "@/backend";
import { copyFor } from "@/components/copy";

// Every page's footer: the imprint and the privacy policy of whoever runs the instance (PREVIEW_IMPRINT_URL, PREVIEW_PRIVACY_URL), each
// only when it is set; with neither, no footer.
export function BrandFooter({ brand, lang }: { brand: Brand; lang: string }) {
  if (!brand.imprintUrl && !brand.privacyUrl) return null;
  const t = copyFor(lang).footer;
  return (
    <footer className="mt-auto border-t border-border">
      <nav aria-label={t.label} className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-1 px-safe py-4 text-sm text-muted">
        {brand.imprintUrl && (
          <a href={brand.imprintUrl} className="underline hover:text-ink">
            {t.imprint}
          </a>
        )}
        {brand.privacyUrl && (
          <a href={brand.privacyUrl} className="underline hover:text-ink">
            {t.privacy}
          </a>
        )}
      </nav>
    </footer>
  );
}
