import type { Brand } from "@/backend";

// The header's name of whoever runs the instance (PREVIEW_BRAND_NAME), a link to their site when PREVIEW_BRAND_URL is set.
export function BrandName({ brand, className }: { brand: Brand; className?: string }) {
  if (!brand.url) return <span className={className}>{brand.name}</span>;
  return (
    <a href={brand.url} className={`${className ?? ""} hover:underline`}>
      {brand.name}
    </a>
  );
}
