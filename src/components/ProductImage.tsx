import type { Product } from "../types";

export type ImageView = "front" | "swatch" | "detail";
export const imageViews: ImageView[] = ["front", "swatch", "detail"];
const viewLabel: Record<ImageView, string> = { front: "front view", swatch: "colour close-up", detail: "detail view" };

type Props = { product: Product; view?: ImageView; shade?: string };

// Placeholder artwork drawn in code, so the demo needs no photo files.
// Real stores replace this component with <img> tags pointing at product photos.
export default function ProductImage({ product, view = "front", shade }: Props) {
  // Real photo available? Show the first one in cards and the basket.
  if (view === "front" && product.images.length > 0) {
    const photo = product.images[0];
    return <img className="product-image" src={photo.url} alt={photo.alt} loading="lazy" decoding="async" />;
  }
  const colour = shade ?? product.tone;
  const cat = product.categoryId;
  const bg = view === "swatch" ? colour : "var(--tint)";
  const fg = view === "swatch" ? "rgba(255,255,255,0.55)" : colour;
  const alt = `Sample image: ${product.name}, ${viewLabel[view]}`;

  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={alt} className="product-image">
      <rect width="400" height="400" fill={bg} />
      {view === "detail" && <circle cx="200" cy="200" r="150" fill="var(--mist)" />}
      <g transform={view === "detail" ? "translate(200 200) scale(1.25) translate(-200 -200)" : undefined}>
        {cat === "lips" && (
          <>
            <rect x="170" y="230" width="60" height="110" rx="6" fill="var(--ink)" />
            <rect x="176" y="190" width="48" height="44" fill="#d9c9a8" />
            <path d="M178 192 L178 150 Q200 128 222 150 L222 192 Z" fill={fg} />
          </>
        )}
        {cat === "face" && (
          <>
            <circle cx="200" cy="215" r="95" fill="var(--ink)" />
            <circle cx="200" cy="215" r="76" fill={fg} />
            <ellipse cx="180" cy="190" rx="26" ry="14" fill="rgba(255,255,255,0.35)" />
          </>
        )}
        {cat === "skincare" && (
          <>
            <rect x="178" y="110" width="44" height="40" rx="6" fill="var(--ink)" />
            <rect x="186" y="150" width="28" height="22" fill="#d9c9a8" />
            <rect x="140" y="170" width="120" height="170" rx="22" fill={fg} />
            <rect x="160" y="215" width="80" height="60" rx="4" fill="rgba(255,255,255,0.7)" />
          </>
        )}
        {cat === "body" && (
          <>
            <rect x="130" y="205" width="140" height="130" rx="18" fill={fg} />
            <rect x="122" y="165" width="156" height="48" rx="10" fill="var(--ink)" />
            <rect x="152" y="238" width="96" height="48" rx="4" fill="rgba(255,255,255,0.7)" />
          </>
        )}
      </g>
      <text x="200" y="378" textAnchor="middle" fontSize="15" fill={view === "swatch" ? "#fff" : "var(--ink)"} opacity="0.75">
        Sample image
      </text>
    </svg>
  );
}
