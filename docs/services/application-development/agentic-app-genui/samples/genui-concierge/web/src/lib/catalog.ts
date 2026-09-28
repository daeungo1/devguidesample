/**
 * Authoritative Contoso Electronics catalog. Prices and stock are fictional
 * sample values; the point is that UI code reads them from here, never from
 * model output.
 */

export type Region = "KR" | "US" | "DE";
export type Currency = "KRW" | "USD" | "EUR";
export const CATEGORIES = ["phone", "tv", "fridge", "washer", "dryer", "aircon"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  phone: "스마트폰",
  tv: "TV",
  fridge: "냉장고",
  washer: "세탁기",
  dryer: "건조기",
  aircon: "에어컨",
};

export interface Product {
  id: string;
  category: Category;
  name: string;
  tagline: string;
  highlights: string[];
  specs: Record<string, string>;
  energyGrade?: string;
  prices: Record<Region, number>;
  availableIn: Region[];
}

export interface PricedProduct extends Omit<Product, "prices" | "availableIn"> {
  region: Region;
  price: number;
  currency: Currency;
  priceLabel: string;
  inStock: boolean;
  /** Product image served by this app; the model never supplies image URLs. */
  image: string;
}

const CURRENCY: Record<Region, { currency: Currency; locale: string }> = {
  KR: { currency: "KRW", locale: "ko-KR" },
  US: { currency: "USD", locale: "en-US" },
  DE: { currency: "EUR", locale: "de-DE" },
};

const ALL: Region[] = ["KR", "US", "DE"];

const PRODUCTS: Product[] = [
  {
    id: "x-ultra",
    category: "phone",
    name: "Contoso X Ultra",
    tagline: "플래그십 카메라와 온디바이스 AI",
    highlights: ["200MP 메인 카메라", "온디바이스 통역", "티타늄 프레임"],
    specs: { 디스플레이: "6.8형 QHD+ 120Hz", 배터리: "5,000mAh", 저장공간: "512GB", 무게: "218g" },
    prices: { KR: 1_798_000, US: 1_299, DE: 1_449 },
    availableIn: ALL,
  },
  {
    id: "x-fold",
    category: "phone",
    name: "Contoso X Fold",
    tagline: "펼치면 태블릿, 접으면 스마트폰",
    highlights: ["7.6형 폴더블 화면", "멀티 윈도 3분할", "스타일러스 펜 호환"],
    specs: { 디스플레이: "7.6형 폴더블 / 6.3형 커버", 배터리: "4,400mAh", 저장공간: "512GB", 무게: "239g" },
    prices: { KR: 2_398_000, US: 1_899, DE: 2_099 },
    availableIn: ALL,
  },
  {
    id: "x-flip",
    category: "phone",
    name: "Contoso X Flip",
    tagline: "주머니 속 컴팩트 폴더블",
    highlights: ["4.0형 커버 화면", "플렉스 모드 셀피", "컬러 에디션"],
    specs: { 디스플레이: "6.7형 폴더블 / 4.0형 커버", 배터리: "4,000mAh", 저장공간: "256GB", 무게: "187g" },
    prices: { KR: 1_498_000, US: 1_099, DE: 1_199 },
    availableIn: ["KR", "US"],
  },
  {
    id: "x-lite",
    category: "phone",
    name: "Contoso X Lite",
    tagline: "합리적인 가격의 AI 스마트폰",
    highlights: ["50MP 카메라", "6년 OS 업데이트", "IP67 방수"],
    specs: { 디스플레이: "6.6형 FHD+ 120Hz", 배터리: "5,000mAh", 저장공간: "256GB", 무게: "196g" },
    prices: { KR: 699_000, US: 499, DE: 549 },
    availableIn: ALL,
  },
  {
    id: "tv-qled-65",
    category: "tv",
    name: "Contoso 4K QLED 65형",
    tagline: "거실 중심의 4K 화질",
    highlights: ["퀀텀닷 4K", "AI 업스케일링", "스마트홈 허브 내장"],
    specs: { 크기: "65형", 해상도: "4K UHD", 주사율: "120Hz" },
    energyGrade: "2등급",
    prices: { KR: 1_890_000, US: 1_399, DE: 1_499 },
    availableIn: ALL,
  },
  {
    id: "tv-oled-55",
    category: "tv",
    name: "Contoso OLED 55형",
    tagline: "작은 거실을 위한 OLED",
    highlights: ["완벽한 블랙", "게이밍 144Hz", "초슬림 디자인"],
    specs: { 크기: "55형", 해상도: "4K UHD", 주사율: "144Hz" },
    energyGrade: "1등급",
    prices: { KR: 2_190_000, US: 1_599, DE: 1_699 },
    availableIn: ALL,
  },
  {
    id: "fridge-4door",
    category: "fridge",
    name: "Contoso 스마트 냉장고 4도어",
    tagline: "4인 가족 대용량",
    highlights: ["875L 대용량", "AI 절전 모드", "식품 관리 카메라"],
    specs: { 용량: "875L", 도어: "4도어" },
    energyGrade: "1등급",
    prices: { KR: 3_290_000, US: 2_599, DE: 2_799 },
    availableIn: ALL,
  },
  {
    id: "fridge-compact",
    category: "fridge",
    name: "Contoso 스마트 냉장고 2도어",
    tagline: "1~2인 가구용 슬림형",
    highlights: ["420L", "저소음 인버터", "슬림 너비 60cm"],
    specs: { 용량: "420L", 도어: "2도어" },
    energyGrade: "1등급",
    prices: { KR: 1_190_000, US: 999, DE: 1_049 },
    availableIn: ALL,
  },
  {
    id: "washer-ai-24",
    category: "washer",
    name: "Contoso AI 세탁기 24kg",
    tagline: "빨래 양에 맞춰 세제·물 자동 조절",
    highlights: ["AI 맞춤 세탁", "세제 자동 투입", "저소음 모터"],
    specs: { 용량: "24kg", 방식: "드럼" },
    energyGrade: "1등급",
    prices: { KR: 1_490_000, US: 1_199, DE: 1_249 },
    availableIn: ALL,
  },
  {
    id: "dryer-heatpump-20",
    category: "dryer",
    name: "Contoso 히트펌프 건조기 20kg",
    tagline: "옷감 손상을 줄이는 저온 건조",
    highlights: ["히트펌프 저온 건조", "AI 건조 시간 예측", "먼지 필터 자동 세척"],
    specs: { 용량: "20kg", 방식: "히트펌프" },
    energyGrade: "1등급",
    prices: { KR: 1_390_000, US: 1_099, DE: 1_149 },
    availableIn: ALL,
  },
  {
    id: "aircon-2in1",
    category: "aircon",
    name: "Contoso 무풍 에어컨 2in1",
    tagline: "거실 스탠드 + 침실 벽걸이",
    highlights: ["무풍 냉방", "AI 쾌적 제어", "에너지 사용량 리포트"],
    specs: { 구성: "스탠드 + 벽걸이", 냉방면적: "81㎡" },
    energyGrade: "1등급",
    prices: { KR: 2_590_000, US: 2_099, DE: 2_249 },
    availableIn: ["KR", "US"],
  },
];

export class UnknownProductError extends Error {
  constructor(public readonly ids: string[]) {
    super(`Unknown product id: ${ids.join(", ")}`);
    this.name = "UnknownProductError";
  }
}

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && value in CURRENCY;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function toPriced(product: Product, region: Region): PricedProduct {
  const { prices, availableIn, ...rest } = product;
  const { currency, locale } = CURRENCY[region];
  const price = prices[region];
  return {
    ...rest,
    region,
    price,
    currency,
    priceLabel: new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(price),
    inStock: availableIn.includes(region),
    image: `/products/${product.id}.webp`,
  };
}

export function listProducts(opts: { region: Region; category?: Category; ids?: string[] }): PricedProduct[] {
  if (opts.ids?.length) {
    const missing = opts.ids.filter((id) => !PRODUCTS.some((p) => p.id === id));
    if (missing.length) throw new UnknownProductError(missing);
    return opts.ids.map((id) => toPriced(PRODUCTS.find((p) => p.id === id)!, opts.region));
  }
  return PRODUCTS.filter((p) => !opts.category || p.category === opts.category).map((p) => toPriced(p, opts.region));
}
