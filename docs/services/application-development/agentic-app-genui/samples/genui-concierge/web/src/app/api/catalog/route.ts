import { NextResponse, type NextRequest } from "next/server";
import { UnknownProductError, isCategory, isRegion, listProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const region = params.get("region") ?? "KR";
  const category = params.get("category") ?? undefined;
  const ids = params.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);

  if (!isRegion(region)) {
    return NextResponse.json({ error: `Unsupported region: ${region}` }, { status: 400 });
  }
  if (category !== undefined && !isCategory(category)) {
    return NextResponse.json({ error: `Unsupported category: ${category}` }, { status: 400 });
  }

  try {
    return NextResponse.json({ products: listProducts({ region, category, ids }) });
  } catch (error) {
    if (error instanceof UnknownProductError) {
      return NextResponse.json({ error: error.message, unknownIds: error.ids }, { status: 404 });
    }
    throw error;
  }
}
