"use client";

import { z } from "zod";
import { CATEGORY_LABELS } from "@/lib/catalog";
import { useCatalog, useRegion } from "@/lib/region";
import { UI_CONTRACT } from "@/lib/thread-store";

export const productSpotlightSchema = z.object({
  productId: z.string().describe("One Contoso product id from lookup_catalog (any category)"),
  reasons: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("Up to three short reasons this product fits the customer. No prices or numbers the catalog does not provide."),
  region: z.enum(["KR", "US", "DE"]).optional().describe("Only when the user names a region other than the current one"),
});

export type ProductSpotlightProps = z.infer<typeof productSpotlightSchema>;

/**
 * Second Controlled component: a single-product detail card. Together with the
 * comparison card it lets the agent choose *which* pre-built component fits the
 * request, while price, stock, specs and image still come from /api/catalog.
 */
export function ProductSpotlight({ productId, reasons, region: askedRegion }: Partial<ProductSpotlightProps>) {
  const uiRegion = useRegion();
  const region = askedRegion ?? uiRegion;
  const catalog = useCatalog(productId ? [productId] : undefined, region);
  const product = catalog.status === "ready" ? catalog.products[0] : undefined;

  return (
    <section className="gu-card" data-pattern="controlled" aria-label="제품 상세">
      <header className="gu-card-head">
        <span className="gu-badge gu-badge-controlled">1 · Controlled</span>
        <h3>{product ? `${CATEGORY_LABELS[product.category]} 상세 · ${product.name}` : "Contoso 제품 상세"}</h3>
      </header>

      {catalog.status === "loading" && <p className="gu-muted">카탈로그에서 제품 정보를 불러오는 중…</p>}
      {catalog.status === "error" && <p className="gu-error" role="alert">제품 상세를 만들 수 없습니다: {catalog.message}</p>}
      {product && (
        <div className="gu-spotlight">
          <div className="gu-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={`${product.name} 제품 이미지`} loading="lazy" width={320} height={320} />
          </div>
          <div className="gu-spotlight-body">
            <p className="gu-muted">{product.tagline}</p>
            <p className="gu-price">{product.priceLabel}</p>
            <p className={product.inStock ? "gu-stock" : "gu-stock is-out"}>{product.inStock ? "구매 가능" : "이 지역 미출시"}</p>
            {product.energyGrade && <p className="gu-muted">에너지 효율 {product.energyGrade}</p>}
            <dl className="gu-specs">
              {Object.entries(product.specs).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="gu-highlights">
              {product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {reasons?.length ? (
              <div className="gu-reasons">
                <strong>이 고객에게 맞는 이유</strong>
                <ul>
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <footer className="gu-card-foot">
        가격·재고·사양 출처: Contoso 카탈로그 API ({region}) · 모델은 제품 ID와 추천 이유만 전달 · UI 계약{" "}
        {UI_CONTRACT.productSpotlight}
      </footer>
    </section>
  );
}
