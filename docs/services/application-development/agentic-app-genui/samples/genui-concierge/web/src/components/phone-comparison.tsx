"use client";

import { z } from "zod";
import { useCatalog, useRegion } from "@/lib/region";
import { UI_CONTRACT } from "@/lib/thread-store";

export const phoneComparisonSchema = z.object({
  productIds: z.array(z.string()).min(2).max(4).describe("Contoso phone ids from lookup_catalog, 2-4 items"),
  focus: z.string().optional().describe("What the customer cares about, e.g. camera, battery, portability"),
  recommendedId: z.string().optional().describe("The id you recommend for this customer, if any"),
});

export type PhoneComparisonProps = z.infer<typeof phoneComparisonSchema>;

/**
 * Controlled pattern: a pre-built, design-system component. The agent only
 * chooses which products to show; prices and stock come from /api/catalog.
 */
export function PhoneComparison({ productIds, focus, recommendedId }: Partial<PhoneComparisonProps>) {
  const region = useRegion();
  const catalog = useCatalog(productIds, region);

  return (
    <section className="gu-card" data-pattern="controlled" aria-label="스마트폰 비교">
      <header className="gu-card-head">
        <span className="gu-badge gu-badge-controlled">1 · Controlled</span>
        <h3>Contoso 스마트폰 비교{focus ? ` · ${focus}` : ""}</h3>
      </header>

      {catalog.status === "loading" && <p className="gu-muted">카탈로그에서 가격과 재고를 불러오는 중…</p>}
      {catalog.status === "error" && <p className="gu-error" role="alert">비교표를 만들 수 없습니다: {catalog.message}</p>}
      {catalog.status === "ready" && (
        <div className="gu-compare" style={{ gridTemplateColumns: `repeat(${catalog.products.length}, minmax(0, 1fr))` }}>
          {catalog.products.map((phone) => (
            <article key={phone.id} className={`gu-phone${phone.id === recommendedId ? " is-recommended" : ""}`}>
              <div className="gu-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={phone.image} alt={`${phone.name} 제품 이미지`} loading="lazy" width={320} height={320} />
              </div>
              {phone.id === recommendedId && <span className="gu-pill">추천</span>}
              <h4>{phone.name}</h4>
              <p className="gu-muted">{phone.tagline}</p>
              <p className="gu-price">{phone.priceLabel}</p>
              <p className={phone.inStock ? "gu-stock" : "gu-stock is-out"}>{phone.inStock ? "구매 가능" : "이 지역 미출시"}</p>
              <dl className="gu-specs">
                {Object.entries(phone.specs).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="gu-highlights">
                {phone.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      <footer className="gu-card-foot">
        가격·재고 출처: Contoso 카탈로그 API ({region}) · 모델 출력값 미사용 · UI 계약 {UI_CONTRACT.phoneComparison}
      </footer>
    </section>
  );
}
