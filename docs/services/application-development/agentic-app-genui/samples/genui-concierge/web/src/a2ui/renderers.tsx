"use client";

import type { CatalogRenderers } from "@copilotkit/a2ui-renderer";
import type { BundleDefinitions } from "./definitions";
import { CATEGORY_LABELS } from "@/lib/catalog";
import { useCatalog, useRegion } from "@/lib/region";
import { UI_CONTRACT } from "@/lib/thread-store";

const text = (value: unknown) => (typeof value === "string" ? value : "");

function ProductTile({ productId, reason }: { productId: string; reason?: unknown }) {
  const region = useRegion();
  const state = useCatalog([productId], region);
  if (state.status === "loading") return <div className="gu-tile is-loading">제품 정보를 불러오는 중…</div>;
  if (state.status === "error") return <div className="gu-tile gu-error" role="alert">{productId}: {state.message}</div>;
  const [p] = state.products;
  return (
    <article className="gu-tile">
      <div className="gu-tile-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt={`${p.name} 제품 이미지`} loading="lazy" width={160} height={160} />
      </div>
      <div className="gu-tile-body">
        <span className="gu-tile-cat">{CATEGORY_LABELS[p.category]}</span>
        <h4>{p.name}</h4>
        <p className="gu-muted">{text(reason) || p.tagline}</p>
        <div className="gu-tile-foot">
          <strong>{p.priceLabel}</strong>
          {p.energyGrade && <span className="gu-grade">에너지 {p.energyGrade}</span>}
          {!p.inStock && <span className="gu-stock is-out">미출시</span>}
        </div>
      </div>
    </article>
  );
}

function BundleSummary({ productIds, budgetLabel }: { productIds: string[]; budgetLabel?: unknown }) {
  const region = useRegion();
  const state = useCatalog(productIds, region);
  if (state.status === "loading") return <div className="gu-summary is-loading">합계를 계산하는 중…</div>;
  if (state.status === "error") return <div className="gu-summary gu-error" role="alert">{state.message}</div>;
  const { products } = state;
  const total = products.reduce((sum, p) => sum + p.price, 0);
  const currency = products[0]?.currency ?? "KRW";
  const locale = { KRW: "ko-KR", USD: "en-US", EUR: "de-DE" }[currency];
  const unavailable = products.filter((p) => !p.inStock);
  return (
    <section className="gu-summary">
      <div>
        <span className="gu-muted">번들 합계 · {products.length}개 제품</span>
        <strong className="gu-total">
          {new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(total)}
        </strong>
      </div>
      {text(budgetLabel) && <span className="gu-muted">고객 예산 {text(budgetLabel)}</span>}
      {unavailable.length > 0 && (
        <p className="gu-error">이 지역 미출시: {unavailable.map((p) => p.name).join(", ")}</p>
      )}
    </section>
  );
}

export const bundleRenderers: CatalogRenderers<BundleDefinitions> = {
  BundleHeader: ({ props }) => (
    <header className="gu-bundle-head">
      <span className="gu-badge gu-badge-declarative">2 · Declarative × Controlled 블록 · {UI_CONTRACT.bundleCatalog}</span>
      <h3>{text(props.title)}</h3>
      {text(props.subtitle) && <p className="gu-muted">{text(props.subtitle)}</p>}
    </header>
  ),
  ProductTile: ({ props }) => <ProductTile productId={props.productId} reason={props.reason} />,
  BundleSummary: ({ props }) => (
    <BundleSummary productIds={Array.isArray(props.productIds) ? props.productIds : []} budgetLabel={props.budgetLabel} />
  ),
  EnergyNote: ({ props }) => <p className="gu-energy">⚡ {text(props.text)}</p>,
  TipList: ({ props }) => (
    <section className="gu-tips">
      {text(props.title) && <h4>{text(props.title)}</h4>}
      <ul>
        {(Array.isArray(props.items) ? props.items : []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  ),
};
